import {
    Component as IntactComponent,
    Props,
    ComponentClass,
    VNodeComponentClass,
    findDomFromVNode,
    IntactDom,
    VNode,
    callAll,
    setInstance,
    validateProps,
    findDomsFromVNode,
} from 'intact';
import Vue, {ComponentOptions, VNode as VueVNode} from 'vue';
import {normalize, normalizeChildren, isBoolean} from './normalize';
import {noop, proxyFragment, proxyFragmentParent} from 'intact-shared';
import {functionalWrapper} from './functionalWrapper';

export * from 'intact';
export {normalizeChildren as normalize};

type GlobalMountedQueue = {
    value: Function[];
    i: number;
} 

let currentInstance: Component | null = null;
let globalMountedQueue: GlobalMountedQueue = {
    value: [],
    i: 0,
};
const pushMountedQueue = (nouse?: any) => {
    globalMountedQueue.i++;
    return globalMountedQueue.value;
};
const callMountedQueue = () => {
    if (--globalMountedQueue.i === 0) {
        callAll(globalMountedQueue.value);
        globalMountedQueue.value = [];
    }
};

// const [pushMountedQueue, popMountedQueue, mountedQueueStack] = createStack<Function[]>();

// for unit test
export {globalMountedQueue};

export class Component<P = {}, E = {}, B = {}> extends IntactComponent<P, E, B> implements Vue {
    // If cid does not exist, Vue will treat it as an async component 
    static cid = 'IntactVue';
    // Vue will read props from Constructor's options
    // static options = {...(Vue as any).options, inheritAttrs: false};
    // Some libraries will extend Vue.options, so we have to use getter to get options
    static get options() { return { ...(Vue as any).options, inheritAttrs: false }; };
    // Need by devtools
    static config = Vue.config;

    static $cid = 'IntactVue';
    static $doubleVNodes = false;
    static normalize = normalizeChildren;
    static functionalWrapper = functionalWrapper;

    // hack for VueConstructor
    static extend: any;
    static nextTick: any;
    static set: any;
    static delete: any;
    static directive: any;
    static filter: any;
    static component: any;
    static use: any;
    static mixin: any;
    static compile: any;
    static observable: any;
    static util: any;
    static version: any;

    public $isVue?: boolean;

    // Properties need by Vue
    public _vnode?: VueVNode;
    public $el!: Element;
    public $options!: ComponentOptions<Vue>;
    public $root!: Vue;
    // hack for Vue interface
    public $parent: any;
    public $children!: Vue[];
    public $refs!: any;
    public $slots!: any;
    public $scopedSlots!: any;
    public $isServer!: any;
    public $data!: any;
    // private $props: any;
    public $ssrContext: any;
    public $vnode: any;
    public $attrs: any;
    public $listeners: any;
    // hack methods
    // public $forceUpdate: any;
    public $set: any;
    public $delete: any;
    public $watch: any;
    public $on: any;
    public $once: any;
    public $off: any;
    public $emit: any;
    public $nextTick: any;
    public $createElement: any;

    // methods on Vue prototype
    public _render: any;
    public _update: any;

    // private properties on vue
    private _isMounted: any;

    // When we call forceUpdate, $mountedQueue has inited and don't init it again.
    private $isForceUpdating!: boolean;
    // The $senior property conflicts in Intact and Vue, save the real Intact $senior to $seniorComponent.
    private $seniorComponent!: Component<any, any, any> | null;
    private $scopeId!: string | undefined;

    constructor(
        options: any,
        $vNode?: VNodeComponentClass,
        $SVG?: boolean,
        $mountedQueue?: Function[],
        $senior?: ComponentClass | null
    );
    constructor(
        props: Props<P, Component<P>> | null | undefined,
        $vNode: VNodeComponentClass,
        $SVG: boolean,
        $mountedQueue: Function[],
        $senior: ComponentClass | null
    );
    constructor(
        props: Props<P, Component<P>> | null | undefined | ComponentOptions<Vue>,
        $vNode: VNodeComponentClass,
        $SVG: boolean,
        $mountedQueue: Function[],
        $senior: ComponentClass | null
    ) {
        const vnode = props && (props as any)._parentVnode;
        if (vnode) {
            $mountedQueue = pushMountedQueue([]);
            const vNode = normalize(vnode) as VNodeComponentClass<this>;
            const $senior = getIntactParent((props as ComponentOptions<Vue>).parent);
            super(vNode.props as P, vNode, $SVG, $mountedQueue, $senior);

            this.$isVue = true;
            this._vnode = {} as VueVNode;

            if (process.env.NODE_ENV !== 'production') {
                validateProps(this.$vNode);
            }

            this.$options = props as ComponentOptions<Vue>;
            const isDoubleVNodes = (this.constructor as typeof Component).$doubleVNodes;
            (props as ComponentOptions<Vue>).render = h => {
                const subTree = h();
                subTree.data = {
                    hook: {
                        prepatch: (oldVnode: VueVNode, vnode: VueVNode) => {
                            const mountedQueue = this.$isForceUpdating ? this.$mountedQueue : (this.$mountedQueue = pushMountedQueue([]));
                            const vNode = normalize(this.$vnode) as VNodeComponentClass<this>;
                            const lastVNode = this.$vNode;
                            this.$vNode = vNode; 
                            vNode.children = this;

                            if (process.env.NODE_ENV !== 'production') {
                                validateProps(this.$vNode);
                            }

                            this.$update(
                                lastVNode,
                                vNode,
                                this.$el.parentElement!,
                                null,
                                mountedQueue,
                                false,
                                true,
                            );

                            // element may have chagned
                            // only check if the component returns only one vNode
                            if (!isDoubleVNodes) {
                                const element = findDomFromVNode(vNode, true) as IntactDom;
                                if (oldVnode.elm !== element) {
                                    this.$vnode.elm = vnode.elm = oldVnode.elm = element;
                                    // set scope id
                                    if (this.$scopeId && element.nodeType === 1) {
                                        (element as Element).setAttribute(this.$scopeId, '');
                                    }
                                }
                            }
                        }
                    }
                };

                if (!this._isMounted) {
                    const nativeCreateComment = document.createComment;
                    document.createComment = () => {
                        document.createComment = nativeCreateComment;

                        this.$init(vNode.props as Props<P, this>);
                        vNode.children = this;
                        this.$render(null, vNode, null as any, null, $mountedQueue);

                        const element = findDomsFromVNode(vNode) as any;
                        if (isDoubleVNodes) {
                            proxyFragment(element);
                        }

                        // Because we make all Intact Components be patchable,
                        // Vue will setScopeId on it, but Intact component may
                        // create a text or comment node. We add setAttribute
                        // method to these nodes to prevent Vue from throwing error
                        // when set scope id on them and save the scopeId to add it
                        // when component updated.
                        if (element.nodeType !== 1) {
                            Object.defineProperty(element, 'setAttribute', {
                                value: (scopeId: string) => {
                                    this.$scopeId = scopeId;
                                } 
                            });
                        }

                        return element as Comment;
                    };
                } else {
                    // We have make it patchable in $mounted,
                    // set its tag as 'div' to make them to be same vnodes
                    subTree.tag = 'fake-div';
                }

                // set parent always to null, to make Vue call invokeInsertHook
                // don't overwrite the pendingInsert array
                Object.defineProperty(subTree, 'parent', {
                    get: () => null,
                    set: noop,
                });

                return subTree;
            };
            Vue.prototype._init.call(this, props);

            // force Vue update Intact component, and prevent Vue from changing it 
            Object.defineProperty(this.$options, '_renderChildren', {
                get: () => true,
                set: noop
            });
            // (this.$options as any)._renderChildren = true;
            (this.$options as any).mounted = [() => {
                if (isDoubleVNodes) {
                    proxyFragmentParent(this.$el as any);
                }
                // if Vue has called the insertedQueue, remove the queue to 
                // avoid Intact call it again on updating 
                this.$vnode.data.queue = null;
                callMountedQueue();
            }];
            (this.$options as any).updated = [() => {
                callMountedQueue();
            }];

            // disable async component 
            this.$inited = true;
        } else {
            super(props as P, $vNode, $SVG, $mountedQueue, $senior);
        }
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

    $mount(el: Element | undefined, hydrating: boolean): this;
    $mount(lastVNode: VNodeComponentClass<this> | null, nextVNode: VNodeComponentClass<this>): void;
    $mount(
        lastVNode: VNodeComponentClass<this> | null | Element | undefined,
        nextVNode: VNodeComponentClass<this> | boolean,
    ) {
        if (isBoolean(nextVNode)) {
            // called by Vue
            Vue.prototype.$mount.call(this, lastVNode, nextVNode);
            // make it patchable to add native events and setScopeId
            this._vnode!.tag = 'fake-div';

            return this;
        } else {
            super.$mount(lastVNode as any, nextVNode);
        }
    }

    $update(
        lastVNode: VNodeComponentClass<this>,
        nextVNode: VNodeComponentClass<this>,
        parentDom: Element, 
        anchor: IntactDom | null,
        mountedQueue: Function[],
        force: boolean,
        fromPrepatch?: boolean,
    ) {
        if (this.$isVue && !fromPrepatch) {
            this.$isForceUpdating = true;
            this._$update(); 
            this.$isForceUpdating = false;
        } else {
            const popInstance = pushInstance(this);
            super.$update(lastVNode, nextVNode, parentDom, anchor, mountedQueue, force);
            if (force) {
                let senior: Component<any, any, any> | null = this;
                while (senior = senior.$senior as Component) {
                    if (senior.$isVue) {
                        callInsertQueue(senior.$vnode);
                        break;
                    }
                }
            }
            popInstance();
        }
    }

    $forceUpdate() {
        this._$update();
        callMountedQueue();
    }

    $destroy() {
        Vue.prototype.$destroy.call(this);
        this.$unmount(this.$vNode, null);
    }

    private _$update() {
        this._update(this._render(), false);
        callInsertQueue(this.$vnode);
    }
}

const prototype = Component.prototype as any;
const vuePrototype = Vue.prototype;
prototype._render = vuePrototype._render;
prototype._update = vuePrototype._update;
prototype.__patch__ = vuePrototype.__patch__;
// prototype.$forceUpdate = vuePrototype.$forceUpdate;
// prototype.$destroy = vuePrototype.$destroy;
// mock api
prototype.$on = noop;
prototype.$off = noop;

function createStack<T>() {
    const stack: T[] = [];

    function pushStack(item: T) {
        stack.push(item);
        // console.log('push', stack.length);
        return item;
    }

    function popStack() {
        // console.log('pop', stack.length);
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

function getIntactParent(parent: Vue | undefined) {
    if (currentInstance) {
        return currentInstance;
    }
    // maybe we mount/update a intact component in Vue component
    while (parent) {
        if (parent instanceof Component) {
            return parent;
        }
        parent = parent.$parent;
    }

    return null;
}

function callInsertQueue(vnode: any) {
    const data = vnode.data;
    const pendingInsert = data.queue;
    if (pendingInsert) {
        pendingInsert.forEach((vnode: VueVNode) => {
            vnode.data!.hook!.insert(vnode);
        });
        data.queue = null;
    }
}
