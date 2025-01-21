import {
    Component as IntactComponent,
    Props,
    VNodeComponentClass,
    ComponentClass,
    isComponentClass,
    createVNode as h,
    createComponentVNode,
    mount,
    findDomFromVNode,
    Children,
    IntactDom,
    provide,
    inject,
    useInstance,
    setInstance,
    callAll,
    validateProps,
    Blocks,
    VNode,
} from 'intact';
import {
    Component as ReactComponent,
    createElement,
    createRef,
    RefObject,
    ReactNode,
    Ref as ReactRef,
    Provider,
    HTMLAttributes,
    ReactChild,
    ReactElement,
} from 'react';
import {normalizeProps, normalizeChildren} from './normalize';
import {precacheFiberNode, updateFiberProps, preparePortalMount, getReactInternals} from './helpers';
import {functionalWrapper} from './functionalWrapper';
import {FakePromise, FakePromises} from './fakePromise';
import {Context, containerComment} from './wrapper';

export * from 'intact';
export {normalizeChildren as normalize};

type ValidReactNode = ReactChild | null | undefined;
type OnEvents<E> = {
    [K in keyof E as `on${Capitalize<string & K>}`]: E[K]
}

type IntactReactProps<P, E, B> = Readonly<P> & Readonly<{
    children?: ReactNode | undefined 
    className?: string
    style?: string | Record<string, string | number>
}> & Readonly<{
    [K in keyof P as `onChange${Capitalize<string & K>}`]?:
        (oldValue: P[K], newValue: P[K]) => void
}> & Readonly<{
    [K in keyof E as `on${Capitalize<string & K>}`]?:
        // @ts-ignore
        (...args: E[K]) => void
}> & Readonly<{
    [K in keyof B as `slot${Capitalize<string & K>}`]?: 
        B[K] extends null ?
            ValidReactNode :
            (data: B[K]) => ValidReactNode
}> & Readonly<Omit<NormalizedHTMLAttibutes, keyof P | keyof OnEvents<E> | 'style'>>

type NormalizedHTMLAttibutes = {
    [Key in keyof HTMLAttributes<any>]: 
        Key extends `on${infer Name}` ? 
            // @ts-ignore
            GlobalEventHandlers[Lowercase<Key>] :
            HTMLAttributes<any>[Key]
}

type MountedQueueWithChildren = Function[] & {
    children?: MountedQueueWithChildren[],
    priority?: Function[],
    pending?: MountedQueueWithChildren[],
    done?: boolean,
};

const PROMISES = '_$IntactReactPromises';
const EMPTY_ARRAY: any[] = [];
if (process.env.NODE_ENV !== 'production') {
    Object.freeze(EMPTY_ARRAY);
}

export class Component<
    P = {},
    E = {},
    B = {},
> extends IntactComponent<P, E, B> implements ReactComponent {
    static $cid = 'IntactReact';
    static normalize = normalizeChildren;
    static functionalWrapper = functionalWrapper;
    static contextType = Context;
    static FakePromise = FakePromise;
    // if the flag is true, it indicate the component returns 2 vNodes,
    // only support two, becasue kpc components don't return vNodes exceed 2.
    static $doubleVNodes = false;

    public context!: any;
    public state!: any;
    public props!: IntactReactProps<P, E, B>;

    // React use prototype.isReactComponent to detect it's a ClassComponent or not
    public isReactComponent!: boolean;

    public $promises!: FakePromises;
    public $reactProviders!: Map<Provider<any>, any>;
    public $parentPromises!: FakePromises | null;
    private $elementRef!: RefObject<HTMLElement>;
    private $elementAlternateRef!: RefObject<HTMLElement>;
    private $isReact!: boolean;
    private $parentElement!: HTMLElement;
    private $pendingUnmount?: Function;

    constructor(props: IntactReactProps<P, E, B>, context: any);
    constructor(
        props: Props<P, Component<P>> | null,
        $vNode: VNodeComponentClass,
        $SVG: boolean,
        $mountedQueue: Function[],
        $senior: Component | null
    );
    constructor(
        props: Props<P, Component<P>> | null,
        $vNodeOrContext: VNodeComponentClass | null,
        $SVG?: boolean,
        $mountedQueue?: Function[],
        $senior?: Component | null
    ) {
        if ($vNodeOrContext && isComponentClass($vNodeOrContext)) {
            // Intact component in intact
            super(props as Props<P, Component<P>>, $vNodeOrContext, $SVG!, $mountedQueue!, $senior!);
        } else {
            // super(null, null as any, false, [], null);

            // Intact component in React
            // @ts-ignore
            const normalizedProps = normalizeProps(props, (this.constructor as any).events);
            const parent = $vNodeOrContext as Component | null;
            const mountedQueue = getMountedQueue(parent);
            super(normalizedProps, null as any, false, mountedQueue, parent);

            this.$inited = true;

            // create $vNode
            this.$vNode = createComponentVNode(
                4,
                this.constructor as typeof Component,
                normalizedProps
            ) as unknown as VNodeComponentClass<this>;

            if (process.env.NODE_ENV !== 'production') {
                validateProps(this.$vNode);
            }

            this.$elementRef = createRef<HTMLElement>();
            if ((this.constructor as typeof Component).$doubleVNodes) {
                this.$elementAlternateRef = createRef<HTMLElement>();
            }
            this.$isReact = true;

            const promises = this.$promises = new FakePromises();
            promises.component = this;
            if (process.env.NODE_ENV !== 'production') {
                promises.name = this.constructor.name;
            }
            this.$parentPromises = inject(PROMISES, null);
            provide(PROMISES, promises);
        }
    }

    render() {
        // save all Context.Proiver, because React will clear the value
        // on commit phase, and we cannot get it when we render react element
        // in Wrapper
        const providers = this.$reactProviders = new Map();
        let returnFiber = getReactInternals(this);

        // let memoizedProps always change to trigger update, see beginWork function in React codes 
        // returnFiber is not extensible
        let memoizedProps: any;
        const defineProperty = (obj: object) => {
            Object.defineProperty(obj, 'memoizedProps', {
                get: () => {
                    return memoizedProps;
                },
                set: (v) => {
                    this.props = memoizedProps = {...v};
                }
            });
        };
        defineProperty(returnFiber);
        // should also change the alternate's memoizedProps
        const alternate = returnFiber.alternate;
        if (alternate) {
            defineProperty(alternate);
        }

        while (returnFiber = returnFiber.return) {
            const tag = returnFiber.tag;
            if (tag === 10) { // is ContextProiver
                const type = returnFiber.type;
                providers.set(type, type._context._currentValue);
            } else if (tag === 3) { // HostRoot
                /**
                 * React will update from root, if root has pendingContext, it will compare
                 * the last value and the current value to change `didPerformWorkStatckCursor`,
                 * if the cursor is true, all children will be updated
                 * @FIXME: Maybe we can use all Consumer to wrap the placeholder element
                 * 
                 * always let hasContextChanged return true to make React update the component,
                 * even if it props has not changed
                 * see unit test: `should update children when provider's children...`
                 * issue: https://github.com/ksc-fe/kpc/issues/533
                 * 
                 * @Modify: we should not update all from root
                 * https://github.com/ksc-fe/kpc/issues/845
                 **/
                // const stateNode = returnFiber.stateNode;
                // if (!stateNode.__intactReactDefinedProperty) {
                    // let context: any;
                    // Object.defineProperty(stateNode, 'pendingContext', {
                        // get() {
                            // return context || (returnFiber.context ? {...returnFiber.context} : Object.create(null));
                        // },
                        // set(v) {
                            // context = v;
                        // }
                    // });
                    // stateNode.__intactReactDefinedProperty = true;
                // }
                break;
            }
        }

        const vNode = createTemplateVNode(this.$elementRef, '1', providers);
        return (this.constructor as typeof Component).$doubleVNodes ?
            [vNode, createTemplateVNode(this.$elementAlternateRef, '2', providers)] :
            vNode;
    }

    componentDidMount() {
        const vNode = this.$vNode;
        const placeholder = this.$elementRef.current!
        const parentElement = this.$parentElement = placeholder.parentElement!;

        // React will assign a emptyObject which is frozen to refs on mountClassInstance
        // we have to re-assign it
        this.refs = {};

        // we may call hooks in init lifecycle, so set instance here,
        // $init method will set it to null
        setInstance(this as Component);
        this.$init(vNode.props as Props<P, this>);

        vNode.children = this;
        /**
         * let intact element be inserted before placeholder, #834
         */
        // let sibling: any = placeholder.nextSibling;
        // let sibling: any = placeholder;
        // while (sibling = sibling.nextSibling) {
            // if (sibling.nodeType !== 8 || sibling.nodeValue !== containerComment) {
                // break;
            // }
        // }
        this.$render(null, vNode, parentElement, placeholder, this.$mountedQueue);

        this.$done(() => {
            handleElementOnMounted(
                parentElement,
                placeholder,
                findDomFromVNode(vNode, true) as HTMLElement
            );
            if ((this.constructor as typeof Component).$doubleVNodes) {
                handleElementOnMounted(
                    parentElement,
                    this.$elementAlternateRef.current!,
                    findDomFromVNode(vNode, false) as HTMLElement
                );
            }
        });
    }

    componentDidUpdate() {
        const normalizedProps = normalizeProps(this.props, (this.constructor as any).events) as Omit<P, 'children'> & {children?: Children};
        const vNode = createComponentVNode(
            4,
            this.constructor as typeof Component,
            normalizedProps,
        ) as unknown as VNodeComponentClass<this>;

        if (process.env.NODE_ENV !== 'production') {
            validateProps(vNode);
        }

        vNode.children = this;
        const lastVNode = this.$vNode;
        this.$vNode = vNode;
        const lastElement = findDomFromVNode(vNode, false) as HTMLElement;

        const promises = this.$promises;
        if (promises.done) {
            promises.reset();

            const mountedQueue = this.$mountedQueue = getMountedQueue(this.$senior as Component, this as Component);
            this.$update(lastVNode, vNode, this.$parentElement, null, mountedQueue, false); 

            this.$done(() => {
                // maybe intact has changed the element
                const element = findDomFromVNode(vNode, false) as HTMLElement;
                if (lastElement !== element) {
                    updateElementOnUpdated(element, lastElement);
                }
            });
        } else {
            this.$update(lastVNode, vNode, this.$parentElement, null, this.$mountedQueue, false); 
        }

    }

    componentWillUnmount() {
        this.$unmount(this.$vNode, null);
    }

    private $done(callback: (() => void) | null) {
        const done = () => {
            const p = FakePromise.all(this.$promises);
            if (callback) {
                return p.then(callback);
            }
            return p;
        };

        const activeParentPromises = getActiveParentPromise(this as Component);
        if (activeParentPromises) {
            activeParentPromises.add(new FakePromise(resolve => {
                done().then(resolve);
            }));
        }
        // const $parentPromises = this.$parentPromises;
        // if ($parentPromises && !$parentPromises.done) {
            // $parentPromises.add(new FakePromise(resolve => {
                // done().then(resolve);
            // }));
        // }
        else {
            done().then(() => {
                callMountedQueue(this.$mountedQueue);
                // callAll(this.$mountedQueue);
            });
        }
    }

    setState() { }

    $mount(lastVNode: VNodeComponentClass<this> | null, nextVNode: VNodeComponentClass<this>) {
        super.$mount(lastVNode, nextVNode);
        if (this.$pendingUnmount) {
            this.$pendingUnmount();
            this.$pendingUnmount = undefined;
        }

        if ((this as any).$isPortal) {
            preparePortalMount(findDomFromVNode(this.get('children') as VNode, false) as HTMLElement);
        }
    }

    $unmount(vNode: VNodeComponentClass<this>, nextVNode: VNodeComponentClass<this> | null) {
        if (!this.$mounted) {
            this.$pendingUnmount = () => super.$unmount(vNode, nextVNode);
        } else {
            super.$unmount(vNode, nextVNode);
        }
    }
}

Component.prototype.isReactComponent = true;

function getMountedQueue(parent: Component | null, instance?: Component): Function[] {
    const queue: MountedQueueWithChildren = [];
    queue.priority = [];
    queue.pending = [];
    if (parent) {
        const mountedQueue = parent.$mountedQueue! as MountedQueueWithChildren 
        const oldMountedQueue = instance?.$mountedQueue as MountedQueueWithChildren;

        /**
         * should search all parent promises
         */
        let parentPromises: FakePromises;
        do {
            parentPromises = parent.$provides![PROMISES] as FakePromises;
            if (!parentPromises.done) {
                if (!mountedQueue.done) {
                    const children = mountedQueue.children || (mountedQueue.children = []);
                    if (oldMountedQueue?.pending?.length) {
                        children.push(...oldMountedQueue.pending);
                        oldMountedQueue.pending.length = 0;
                    }
                    children.push(queue);
                } else {
                    mountedQueue.pending!.push(queue);
                }
                break;
            }
        } while (parent = parentPromises!.component!.$senior as Component);
    }
    return queue;
}

function getActiveParentPromise(component: Component) {
    let parentPromises: FakePromises | null;
    while (parentPromises = component.$parentPromises) {
        if (!parentPromises.done) {
            break;
        }
        component = parentPromises.component!;
    }

    return parentPromises;
}

function callMountedQueue(mountedQueue: MountedQueueWithChildren) {
    const priority = mountedQueue.priority;
    if (priority) {
        callAll(priority);
    }

    const children = mountedQueue.children;
    if (children) {
        for (let i = 0; i < children.length; i++) {
            callMountedQueue(children[i]);
        }
    }

    callAll(mountedQueue);
}

function createTemplateVNode(ref: RefObject<HTMLElement>, key: string, providers: Map<Provider<unknown>, unknown>) {
    let vnode: ReactElement = createElement('template', {
        ref,
        key,
        'data-intact-react': '',
    });

    providers.forEach((value, provider) => {
        vnode = createElement((provider as any)._context.Consumer, {key}, ((vnode: ReactElement) => {
            return () => vnode;
        })(vnode));
    });

    return vnode;
}

function handleElementOnMounted(parentElement: HTMLElement, placeholder: HTMLElement, element: HTMLElement) {
    (parentElement as any).removeChild(placeholder, true);
    updateElementOnUpdated(element, placeholder);
}

function updateElementOnUpdated(element: HTMLElement, placeholder: HTMLElement) {
    // replace some properties like React do
    const fiber = precacheFiberNode(element, placeholder);
    // if we return a React element directly, we can not replace its props by placeholder's props,
    // otherwise its event props will be removed
    // updateFiberProps(element, placeholder);
    fiber.stateNode = element;
    const alternate = fiber.alternate;
    if (alternate) {
        alternate.stateNode = element;
    }
}
