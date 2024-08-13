import {
    Component as IntactComponent,
    VNodeComponentClass,
    mount,
    patch,
    unmount,
    findDomFromVNode,
    IntactDom,
    Props,
    ComponentClass,
    callAll,
    isFragment,
    VNode as IntactVNode,
    findDomsFromVNode,
} from 'intact';
import {
    ComponentOptions,
    ComponentPublicInstance,
    createVNode,
    Comment,
    ComponentInternalInstance,
    HTMLAttributes,
    VNode,
    Fragment,
    ReactiveEffect,
} from 'vue';
import {normalize, normalizeChildren} from './normalize';
import {functionalWrapper} from './functionalWrapper';
import {isFunction, proxyFragment, proxyFragmentParent, isFragmentDom} from 'intact-shared';
import {setScopeId}  from './scoped';

export * from 'intact';
export {normalizeChildren as normalize};

export interface IntactComponentOptions extends ComponentOptions {
    Component: typeof Component
}

type SetupState = {
    instance: Component | null
}

type VNodeComponentClassMaybeWithVueInstance = 
    & VNodeComponentClass<ComponentClass>
    & {_vueInstance?: ComponentInternalInstance}

type IntactVueNextProps<P, E> = 
    & Readonly<P>
    & Readonly<Omit<HTMLAttributes, keyof P>>
    & Readonly<{
        [K in keyof P as `onChange:${string & K}`]?:
            (oldValue: P[K], newValue: P[K]) => void
    }>
    & Readonly<{
        [K in keyof E as `on${Capitalize<string & K>}`]?:
            (...args: any[] & E[K]) => void
    }>;

enum StackPhase {
    Mount,
    Update,
}
type MountedQueueStackItem = {
    instance: ComponentInternalInstance,
    queue: Function[],
};

let currentInstance: Component | null = null;

const mountedQueueStack: Map<number, Function[]> = new Map();
const pushMountedQueue = (uid: number) => {
    callMountedQueue(uid);

    const mountedQueue: Function[] = [];
    mountedQueueStack.set(uid, mountedQueue);

    return mountedQueue;
};
const callMountedQueue = (uid: number) => {
    const mountedQueue = mountedQueueStack.get(uid);
    if (!mountedQueue) return;

    mountedQueueStack.delete(uid);

    callAll(mountedQueue);
};

// for unit test
export {mountedQueueStack};

export class Component<P = {}, E = {}, B = {}> extends IntactComponent<P, E, B> {
    static $cid = 'IntactVueNext';
    static $doubleVNodes = false;
    static __cache: IntactComponentOptions | null = null;

    static get __vccOpts(): IntactComponentOptions {
        const Ctor = this as typeof Component;
        if (Ctor.__cache) {
            return Ctor.__cache;
        }

        return (Ctor.__cache = {
            name: Ctor.displayName || Ctor.name,
            Component: Ctor,
            // Don't inherit attributes, becasue kpc component has do it.
            // https://v3.vuejs.org/guide/component-attrs.html#attribute-inheritance
            inheritAttrs: false,

            setup(props, setupContext) {
                const setupState: SetupState = {instance: null};
                const proxy = new Proxy(setupState, {
                    get({instance}, key: keyof Component | '__v_isReactive' | 'instance') {
                        if (key === '__v_isReactive') return true;
                        if (instance === null) return null;
                        if (key === 'instance') return instance;

                        const value = instance[key];
                        if (isFunction(value)) {
                            // should bind instance, otherwise the `this` may point to proxyToUse
                            return value.bind(instance);
                        }
                        return value;
                    },

                    set(setupState, key, value) {
                        // if (key === 'instance') {
                            return Reflect.set(setupState, key, value);
                        // }
                        // return Reflect.set(setupState.instance!, key, value);
                    },

                    getOwnPropertyDescriptor() {
                        return {
                            value: undefined,
                            writable: true,
                            enumerable: true,
                            configurable: true,
                        };
                    },

                    ownKeys() {
                        return [];
                    }
                });

                return proxy;
            },

            render(proxyToUse: ComponentPublicInstance, renderCache: any, props: any, setupState: SetupState) {
                const vueInstance = proxyToUse.$;
                const vNode = normalize(vueInstance.vnode, false) as VNodeComponentClassMaybeWithVueInstance;

                const _setScopeId = (element: IntactDom) => {
                    const vnode = vueInstance.vnode;
                    setScopeId(element, vnode, vnode.scopeId, (vnode as any).slotScopeIds, vueInstance.parent, true);
                }

                const mountedQueue = pushMountedQueue(vueInstance.uid);
                const parentComponent = getIntactParent(vueInstance.parent);
                const isSVG = parentComponent ? parentComponent.$SVG : false;

                const subTree = createVNode(Comment);

                if (!vueInstance.isMounted) {
                    // add subTree firstly, because when we mount vue element in intact,
                    // Vue need the property on calling setScopeId
                    vueInstance.subTree = subTree;
                    vNode._vueInstance = vueInstance;
                   
                    mount(vNode, null, parentComponent, isSVG, null, mountedQueue);

                    // hack the nodeOps of Vue to create the real dom instead of a comment
                    const elements = findDomsFromVNode(vNode) as IntactDom;
                    if (Ctor.$doubleVNodes) {
                        proxyFragment(elements as any);
                    }
                    const nativeCreateComment = document.createComment;
                    document.createComment = () => {
                        document.createComment = nativeCreateComment;
                        if (isFragmentDom(elements)) {
                            _setScopeId((elements as any).firstElementChild!);
                        } else {
                            _setScopeId(elements);
                        }
                        return elements as Comment;
                    };
                } else {
                    const instance = setupState.instance as Component;
                    const lastVNode = instance.$vNode;
                    patch(lastVNode, vNode, this.$el.parentElement!, parentComponent, isSVG, null, mountedQueue, false);

                    // element may have changed 
                    // only check if the component returns only one vNode
                    if (!Ctor.$doubleVNodes) {
                        const element = findDomFromVNode(vNode, true) as IntactDom;
                        const oldSubTree = vueInstance.subTree;
                        if (oldSubTree.el !== element) {
                            oldSubTree.el = element;
                            // set scope id
                            _setScopeId(element);
                        }
                    }
                }

                return subTree;
            },

            mounted() {
                proxyFragmentParent(this.$el);
                callMountedQueue(this.$.uid);
            },

            updated() {
                callMountedQueue(this.$.uid);
            },

            beforeUnmount() {
                // we should get property by instance, if the name starts with '$'
                unmount(this.instance.$vNode, null); 
            },
        });
    };

    static functionalWrapper = functionalWrapper;
    static normalize = normalizeChildren;

    public vueInstance: ComponentInternalInstance | undefined;
    private $isVueNext: boolean = false;
    private $effect?: ReactiveEffect;

    // for Vue infers types
    public $props!: IntactVueNextProps<P, E>;


    constructor(
        props: Props<P, Component<P>> | null | undefined,
        $vNode: VNodeComponentClassMaybeWithVueInstance,
        $SVG: boolean,
        $mountedQueue: Function[],
        $parent: ComponentClass | null
    ) {
        super(props, $vNode, $SVG, $mountedQueue, $parent);
        const vuePublicInstance = $vNode._vueInstance;
        this.vueInstance = vuePublicInstance;
        if (vuePublicInstance) {
            // set the instance to the setupState of vueIntance.$
            // ps: setupState is @internal in vue
            (vuePublicInstance as any).setupState.instance = this;
            this.$isVueNext = true;
        }
        // disable async component 
        this.$inited = true;
    }

    $render(
        lastVNode: VNodeComponentClass<this> | null,
        nextVNode: VNodeComponentClass<this>,
        parentDom: Element,
        anchor: IntactDom | null,
        mountedQueue: Function[]
    ): void {
        const popInstance = pushInstance(this);
        super.$render(lastVNode, nextVNode, parentDom, anchor, mountedQueue);
        popInstance();
    }

    $update(
        lastVNode: VNodeComponentClass<this>,
        nextVNode: VNodeComponentClass<this>,
        parentDom: Element,
        anchor: IntactDom | null,
        mountedQueue: Function[],
        force: boolean
    ): void {
        const fn = (mountedQueue: Function[]) => {
            const popInstance = pushInstance(this);
            super.$update(lastVNode, nextVNode, parentDom, anchor, mountedQueue, force);
            popInstance();
            // effect.stop();
        }
        if (force) {
            const effect = this.$effect = new ReactiveEffect(() => {
                const mountedQueue = this.$mountedQueue = [];
                fn(mountedQueue);
                callAll(mountedQueue);
            });
            effect.run();
        } else {
            fn(mountedQueue);
        }
    }

    $unmount(vNode: VNodeComponentClass<this>, nextVNode: VNodeComponentClass<this> | null) {
        if (this.$effect) this.$effect.stop();
        super.$unmount(vNode, nextVNode);
    }
} 

function createStack<T>() {
    const stack: T[] = [];

    function pushStack(item: T) {
        stack.push(item);
        return item;
    }

    function popStack() {
        return stack.pop();
    }

    return [pushStack, popStack, stack] as const;
}

const [_pushInstance, _popInstance] = createStack<Component<any, any, any>>();
function pushInstance(instance: Component<any, any, any>) {
    const lastIntance = currentInstance;
    currentInstance = _pushInstance(instance);
    return () => {
        _popInstance();
        currentInstance = lastIntance;
    }
};

function getIntactParent(parent: ComponentInternalInstance | null) {
    if (currentInstance) {
        return currentInstance;
    }
    // maybe we mount/update a intact component in Vue component
    // let parent: ComponentInternalInstance | null = instance;
    while (parent) {
        const instance = (parent as any).setupState.instance;
        if (instance instanceof Component) {
            return (parent as any).fakeInstance || instance;
        }
        parent = parent.parent;
    }

    return null;
}
