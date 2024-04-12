import {Component as ReactComponent, ReactNode, Fragment, useState, useEffect} from 'react';
import {
    render,
    container,
    createIntactComponent, 
    SimpleIntactComponent,
    ChildrenIntactComponent,
    SimpleReactComponent,
    PropsIntactComponent,
    expect,
    wait,
    renderApp,
    getSpyError,
} from './helpers';
import {Component, createVNode as h, findDomFromVNode, createRef, VNode, provide, inject, VNodeComponentClass, IntactDom} from '../src';
import {act} from 'react-dom/test-utils';

describe('Intact React', () => {
    describe('Intact Features', () => {
        describe('Lifecycle', () => {
            it('lifecycle of intact in react', () => {
                const beforeMount = sinon.spy(() => console.log('beforeMount'));
                const mounted = sinon.spy(() => console.log('mounted'));
                const beforeUpdate = sinon.spy(() => console.log('beforeUpdate'));
                const updated = sinon.spy(() => console.log('updated'));
                const beforeUnmount = sinon.spy(() => console.log('beforeUnmount'));
                const unmounted = sinon.spy(() => console.log('unmounted'));

                class Test extends Component {
                    static template = '<div>test</div>';
                    beforeMount = beforeMount;
                    mounted = mounted;
                    beforeUpdate = beforeUpdate;
                    updated = updated;
                    beforeUnmount = beforeUnmount;
                    unmounted = unmounted;
                }
                const test = (counts: number[]) => {
                    expect(beforeMount.callCount).to.eql(counts[0]);
                    expect(mounted.callCount).to.eql(counts[1]);
                    expect(beforeUpdate.callCount).to.eql(counts[2]);
                    expect(updated.callCount).to.eql(counts[3]);
                    expect(beforeUnmount.callCount).to.eql(counts[4]);
                    expect(unmounted.callCount).to.eql(counts[5]);
                }

                const instance = renderApp(function() {
                    return <div>{this.state.show ? <Test /> : undefined}</div>
                }, {show: true, a: 0});

                test([1, 1, 0, 0, 0, 0]);
                expect(beforeMount.calledBefore(mounted)).to.be.true;

                // update
                act(() => {
                    instance.setState({a: 1});
                });
                test([1, 1, 1, 1, 0, 0]);
                expect(beforeMount.calledBefore(mounted)).to.be.true;

                // destroy
                act(() => {
                    instance.setState({show: false});
                });
                test([1, 1, 1, 1, 1, 1]);
                expect(beforeUnmount.calledBefore(unmounted)).to.be.true;
            });

            it('lifecycle of react in intact', () => {
                const getDerivedStateFromProps = sinon.spy(function(props: any) {
                    console.log('getDerivedStateFromProps');
                    return props;
                });
                const shouldComponentUpdate = sinon.spy(() => {
                    console.log('shouldComponentUpdate');
                    return true;
                });
                const getSnapshotBeforeUpdate = sinon.spy(() => {
                    console.log('getSnapshotBeforeUpdate');
                    return null;
                });
                const componentDidMount = sinon.spy(() => console.log('componentDidMount'));
                const componentDidUpdate = sinon.spy(() => console.log('componentDidUpdate'));
                const componentWillUnmount = sinon.spy(() => console.log('componentWillUnmount'));
                class Test extends ReactComponent<{a: number}, {a: number}> {
                    static getDerivedStateFromProps = getDerivedStateFromProps;
                    constructor(props: {a: number}) {
                        super(props);
                        this.state = {a: 0};
                    }
                    render() {
                        return <div>{this.state.a}</div>
                    }
                }
                Object.assign(Test.prototype, {
                    shouldComponentUpdate,
                    getSnapshotBeforeUpdate,
                    componentDidMount,
                    componentDidUpdate,
                    componentWillUnmount,
                });
                const instance = renderApp(function() {
                    return <ChildrenIntactComponent>
                        {this.state.a === 3 ? undefined : <Test a={this.state.a} />}
                    </ChildrenIntactComponent>
                }, {a: 1});

                expect(getDerivedStateFromProps.callCount).to.eql(1);
                expect(componentDidMount.callCount).to.eql(1);

                // update
                act(() => {
                    instance.setState({a: 2});
                });
                expect(getDerivedStateFromProps.callCount).to.eql(2);
                expect(componentDidMount.callCount).to.eql(1);
                expect(shouldComponentUpdate.callCount).to.eql(1);
                expect(getSnapshotBeforeUpdate.callCount).to.eql(1);
                expect(componentDidUpdate.callCount).to.eql(1);

                // destroy
                act(() => {
                    instance.setState({a: 3});
                });
                expect(componentWillUnmount.callCount).to.eql(1);
            });

            it('lifecycle of mount of nested intact component', () => {
                const mount1 = sinon.spy(function(this: C) {
                    console.log(1);
                    expect(document.body.contains(this.elementRef.value)).to.eql(true);
                    expect(this.elementRef.value!.outerHTML).to.eql(
                        '<div><div><div>test</div></div>#</div>'
                    );
                });
                const mount2 = sinon.spy(function(this: D) {
                    console.log(2);
                    expect(document.body.contains(this.elementRef.value)).to.eql(true);
                    expect(this.elementRef.value!.outerHTML).to.eql('<div>test</div>');
                });
                class C extends Component {
                    static template = `<div ref={this.elementRef}>{this.get('children')}</div>`;
                    public elementRef = createRef<HTMLElement>();
                    mounted() {
                        mount1.call(this);
                    }
                }
                class D extends Component {
                    static template = `<div ref={this.elementRef}>test</div>`;
                    public elementRef = createRef<HTMLElement>();
                    mounted() {
                        mount2.call(this);
                    }
                }
                const instance = renderApp(function() {
                    return (
                        <div className="a">
                            <C>
                                <div>
                                    <D />
                                </div>
                            </C>
                        </div>
                    )
                });
                expect(mount1.callCount).to.eql(1);
                expect(mount2.callCount).to.eql(1);
                // order is unnecessary
                // expect(mount2.calledAfter(mount1)).be.true;
            });

            // order may be unnecessary
            // it('the order of mounted', () => {
                // function test(childrenA?: ReactNode | null, childrenB?: ReactNode | null) {
                    // const mount1 = sinon.spy(() => console.log('1'));
                    // const mount2 = sinon.spy(() => console.log('2'));
                    // class A extends Component {
                        // static template = `<div>{this.get('children')}</div>`;
                        // mounted() {
                            // mount1();
                        // }
                    // }
                    // class B extends Component {
                        // static template = `<div>{this.get('children')}</div>`;
                        // mounted() {
                            // mount2();
                        // }
                    // }

                    // const instance = renderApp(function() {
                        // return (
                            // <div>
                                // <A>{childrenA}</A>
                                // <B>{childrenB}</B>
                            // </div>
                        // )
                    // });
                    // expect(mount1.calledBefore(mount2)).be.true;
                // }

                // test();
                // test(<a>1</a>);
                // test(null, <b>2</b>);
                // test(<a>1</a>, <b>2</b>);
            // });

            it('the lifecycles of sub components should be called before parent component', async () => {
                const mount1 = sinon.spy(() => console.log('1'));
                const mount2 = sinon.spy(() => console.log('2'));
                const mount3 = sinon.spy(() => console.log('3'));
                class A extends Component {
                    static template = `<div>{this.get('children')}</div>`;
                    $render(...args: any[]) {
                        const mountedQueue = args[args.length - 1];
                        mountedQueue.priority.push(mount3);
                        (super.$render as any)(...args); 
                    }
                    mounted() {
                        mount1();
                    }
                }
                class B extends Component {
                    static template = `<div>{this.get('children')}</div>`;
                    mounted() {
                        mount2();
                    }
                }

                renderApp(function() {
                    return (
                        <A>
                            <div>
                                <B>test</B>
                            </div>
                        </A>
                    ); 
                });

                expect(mount3.calledBefore(mount2)).to.be.true;
                expect(mount2.calledBefore(mount1)).to.be.true;
            });

            it('lifecycle of mount of existing firsthand intact component', () => {
                const mount = sinon.spy(function() {
                    console.log('mount');
                });
                class C extends Component<{show?: boolean}> {
                    static template = `<div>{this.get('show') ? this.get('children') : null}</div>`
                    mounted() {
                        mount();
                    }
                }
                const instance = renderApp(function() {
                    return (
                        <div>
                            <ChildrenIntactComponent>
                                <C ref={(i: any) => this.c = i} show={this.state.show}>
                                    <div>
                                        <C show={true}>
                                            <span>test</span>
                                        </C>
                                    </div>
                                </C>
                            </ChildrenIntactComponent>
                        </div>
                    )
                }, {show: false});
                expect(mount.callCount).to.eql(1);
                act(() => {
                    instance.setState({show: true});
                });
                expect(mount.callCount).to.eql(2);
            });

            it('lifecycle of componentDidMount of nested react component in intact component', () => {
                const componentDidMount = sinon.spy(function(this: Test) {
                    expect(document.body.contains(this.dom)).to.be.true;
                });
                class Test extends ReactComponent {
                    public dom: HTMLElement | null = null;
                    render() {
                        return <div ref={(i: HTMLDivElement) => this.dom = i}>test</div>
                    }
                }
                Test.prototype.componentDidMount = componentDidMount;
                const instance = renderApp(function() {
                    return (
                        <ChildrenIntactComponent>
                            <div>
                                <Test />
                            </div>
                        </ChildrenIntactComponent>
                    )
                });
                expect(componentDidMount.callCount).to.eql(1);
            });

            it('mounted lifecycle of intact in intact template', () => {
                const mount = sinon.spy(function(this: D) {
                    expect(document.body.contains(this.elementRef.value)).to.be.true;
                });
                class C extends Component {
                    static template = `const D = this.D; <D />`;
                    D = D;
                }
                class D extends Component {
                    static template = `<div ref={this.elementRef}>test</div>`;
                    public elementRef = createRef<HTMLElement>();
                    mounted() {
                        mount.call(this);
                    }
                }
                const instance = renderApp(function() {
                    return <C />
                });
                expect(mount.callCount).to.eql(1);
            });

            it('mounted lifycycle of intact in react render method', () => {
                const mount = sinon.spy(function(this: D) {
                    expect(document.body.contains(this.elementRef.value)).to.be.true;
                });
                class C extends ReactComponent {
                    render() {
                        return <D />
                    }
                }
                class D extends Component {
                    static template = `<div ref={this.elementRef}>test</div>`;
                    public elementRef = createRef<HTMLElement>();
                    mounted() {
                        mount.call(this);
                    }
                }
                const instance = renderApp(function() {
                    return <C />
                });
                expect(mount.callCount).to.eql(1);
            });

            it('componentWillUnmount will be called when remove the element by parent', () => {
                const componentWillUnmount = sinon.spy(() => {
                    console.log('unmount')
                });
                class C extends ReactComponent {
                    render() {
                        return <div>react</div>
                    }
                }
                Object.assign(C.prototype, {
                    componentWillUnmount,
                });

                const instance = renderApp(function() {
                    return <div>
                        {this.state.a === 1 ?
                            <ChildrenIntactComponent><C /></ChildrenIntactComponent> :
                            <div>test</div>
                        }
                    </div>
                }, {a: 1});
                act(() => {
                    instance.setState({a: 2});
                });
                expect(componentWillUnmount.callCount).to.eql(1);
            });

            it('update on rendering', () => {
                const mount = sinon.spy(function(this: D) {
                    console.log('mounted');
                    expect(document.body.contains(this.elementRef.value)).to.be.true;
                });
                class C extends ReactComponent {
                    render() {
                        return <D onChange={() => this.forceUpdate()}>
                            <div>test</div>
                        </D>
                    }
                }
                class D extends Component<{}, {change: []}> {
                    static template = `<div ref={this.elementRef}>{this.get('children')}</div>`;
                    public elementRef = createRef<HTMLElement>();
                    init() {
                        this.trigger('change');
                    }
                    mounted() {
                        mount.call(this);
                    }
                }
                const instance = renderApp(function() {
                    return <C />
                });
                expect(mount.callCount).to.eql(1);
            });

            it('update in updating and there are multiple react elements nested in intact component', () => {
                const orders: string[] = [];
                class Drawer extends Component<{show: boolean}> {
                    static template = `
                        <div class="drawer">
                            <template v-if={this.get('show')}>{this.get('children')}</template>
                        </div>
                    `;
                }
                class Foo extends Component {
                    static template = `<div class="foo">{this.get('children')}</div>`
                    mounted() {
                        console.log('mounted');
                        orders.push('mounted');
                    }
                    unmounted() {
                        console.log('unmounted');
                        orders.push('unmounted');
                    }
                }
                function Test() {
                    return <Foo id="1"><span>test</span></Foo>;
                }
                function Bar(props: {show: boolean}) {
                    const [count, setCount] = useState(0);
                    useEffect(() => {
                        if (!props.show) return;
                        setCount((count) => count + 1);
                    }, [props.show]);

                    return <Drawer show={props.show}>
                        {count !== 1 && <Test />} 
                        {count !== 1 && <Foo id="2"/>}
                    </Drawer>
                }
                function App() {
                    const [show, setShow] = useState(false);
                    return <div>
                        <div onClick={() => setShow(true)} id="click">click</div>
                        <Bar show={show} />
                    </div>
                }

                render(<App />);
                act(() => {
                    container.querySelector<HTMLDivElement>('#click')!.click();
                });
                expect(orders).to.eql(['mounted', 'mounted', 'unmounted', 'unmounted']);
            });

            it('render react component which will update in render phase', async () => {
                class Drawer extends Component {
                    static template = `
                        <div class="drawer">{this.get('children')}</div>
                    `;

                    $update(
                        lastVNode: VNodeComponentClass<this>,
                        nextVNode: VNodeComponentClass<this>,
                        parentDom: Element, 
                        anchor: IntactDom | null,
                        mountedQueue: Function[],
                        force: boolean,
                    ) {
                        mountedQueue.push(() => {
                            super.$update(lastVNode, nextVNode, parentDom, anchor, mountedQueue, force);
                        });
                    }
                }
                class Foo extends Component {
                    static template = `<div class="foo">{this.get('children')}</div>`
                }
                function Bar() {
                    return <p>
                        <Foo id="bar"><div>bar</div></Foo>
                        <Baz />
                    </p>
                }

                function Baz() {
                    const [count, setCount] = useState(0);
                    useEffect(() => {
                        setCount((count) => count + 1);
                    }, [setCount]);

                    return <Drawer ev-$updated={() => console.log('updated drawer')}>
                        <Foo id="baz" ev-$updated={() => console.log('updated baz')}>
                            <Qux count={count} />
                        </Foo>
                    </Drawer>

                }
                function Qux(props: {count: number}) {
                    return <Foo id="qux"><span>{props.count}</span></Foo>;
                }

                function App() {
                    return <Foo id="app"><Bar /></Foo>
                }

                render(<App />);
            });

            it('should call mounted callbacks before updated callbacks', async () => {
                class Container extends Component {
                    static template = `<div>{this.get('children')}</div>`;
                }
                function TaskLibaray() {
                    return (
                        <div>
                            <ChildrenIntactComponent id="1">
                                <div className="task-card">
                                    {[1, 2].map((task) => (
                                        <TaskItem key={task} />
                                    ))}
                                </div>
                            </ChildrenIntactComponent>
                        </div>
                    )
                }

                function TaskItem() {
                    return (
                        <div>
                            <Container>
                                <div className="taskItem-down">
                                    <ChildrenIntactComponent id="2"><div>label</div></ChildrenIntactComponent>
                                    <WebhookEdit />
                                </div>
                            </Container>
                        </div>
                    )
                }

                function WebhookEdit() {
                  	const [value, setValue] = useState(1);
				  	useEffect(() => {
						setValue(2);
				  	});
                    return (
                        <div>
                            <Test />
                        </div>
                    )
				}

                const orders: string[] = [];
                class Test extends Component {
                    static template = `<div ref={this.ref}>test</div>`;

                    ref = createRef();

                    mounted() {
                        console.log('mounted', this.ref.value);
                        expect(this.ref.value).to.exists;
                        orders.push('mounted');
                    }

                    updated() {
                        console.log('updated', this.ref.value);
                        expect(this.ref.value).to.exists;
                        orders.push('updated');
                    }
                }

                render(<TaskLibaray />);

                expect(orders).to.eql(['mounted', 'updated', 'mounted', 'updated']);
            });
        });

        describe('vNode', () => {
            it('should get $senior of nested intact component', () => {
                class C extends Component {
                    static template = `<div>{this.get('children')}</div>`;
                    mounted() {
                        expect(this.$senior).to.be.null;
                    }
                }
                class D extends Component {
                    static template = `<span>test</span>`;
                    mounted() {
                        expect(this.$senior).be.instanceof(E);
                        expect(this.$senior!.$senior).to.be.instanceof(C);
                    }
                }
                class E extends Component {
                    static template = `<i>{this.get('children')}</i>`;
                    mounted() {
                        expect(this.$senior).to.be.instanceof(C);
                    }
                }
                class F extends Component {
                    static template = `<span>f</span>`;
                    mounted() {
                        // firsthand intact component
                        expect(this.$senior).to.be.instanceof(C);
                    }
                }
                class G extends Component {
                    static template = `<b>g</b>`;
                    mounted() {
                        expect(this.$senior).to.be.instanceof(ChildrenIntactComponent);
                    }
                }

                const instance = renderApp(function() {
                    return <div>
                        <C>
                            <p><E><b><D /></b></E></p>
                            <F />
                            <ChildrenIntactComponent><div><G /></div></ChildrenIntactComponent>
                            <ChildrenIntactComponent><G /></ChildrenIntactComponent>
                        </C>
                        <ChildrenIntactComponent><div>aaa</div></ChildrenIntactComponent>
                    </div>
                });
            });

            it('should get $senior which return by functional component', () => {
                const C = Component.functionalWrapper((props) => {
                    return h(D, props);
                });
                class D extends Component {
                    static template = `<div>test</div>`;
                    mounted() {
                        expect(this.$senior).to.be.instanceof(E);
                    }
                }
                class E extends Component {
                    static template = `<div>{this.get('children')}</div>`
                }

                const instance = renderApp(function() {
                    return (
                        <ChildrenIntactComponent>
                            <E>
                                <div>
                                    <C />
                                </div>
                                <C />
                            </E>
                        </ChildrenIntactComponent>
                    )
                });
            });

            it('should get $senior which nest functional component in functional component', () => {
                const C = Component.functionalWrapper<{className?: string}>((props) => {
                    return h(D, props);
                });
                let firstD = true;
                class D extends Component {
                    static template = `<div>{this.get('children')}</div>`;
                    mounted() {
                        if (firstD) {
                            expect(this.$senior).to.be.null;
                            firstD = false;
                        } else {
                            expect(this.$senior).to.be.instanceof(E);
                        }
                    }
                }

                let e: E;
                class E extends Component<{show?: boolean}> {
                    static template = `<div>{this.get('show') ? this.get('children') : null}</div>`;
                    mounted() {
                        e = this;
                        expect(this.$senior).to.be.instanceof(D);
                    }
                }

                class F extends Component {
                    static template = `<div>{this.get('children')}</div>`;
                    mounted() {
                        // update in updating
                        e.forceUpdate();
                        expect(this.$senior).to.be.instanceof(D);
                        expect(this.$senior!.$senior).to.be.instanceof(E);
                        expect(this.$senior!.$senior!.$senior).to.be.instanceof(D);
                    }
                }

                const instance = renderApp(function() {
                    return (
                        <C className="a">
                            <i>test</i>
                            <E>
                                <C className="b">
                                    <F><span>test</span></F>
                                </C>
                            </E>
                        </C>
                    )
                });
                e!.set('show', true);
            });

            it('should get $senior in template & update', () => {
                const mount = sinon.spy();
                const update = sinon.spy();

                class C extends Component {
                    static template = `<div>{this.get('children')}</div>`
                }
                class D extends Component {
                    static template = `<i>{this.get('children')}</i>`;
                    mounted() {
                        mount();
                        expect(this.$senior).to.be.instanceof(E);
                        expect(this.$senior!.$senior).to.be.instanceof(C);
                        expect(this.$senior!.$senior!.$senior).to.be.instanceof(F);
                    }
                    updated() {
                        update();
                        expect(this.$senior).to.be.instanceof(E);
                        expect(this.$senior!.$senior).to.be.instanceof(C);
                        expect(this.$senior!.$senior!.$senior).to.be.instanceof(F);
                    }
                }
                class E extends Component {
                    static template = `const D = this.D; <D>{this.get('children')}</D>`;
                    D = D;
                }
                class F extends Component {
                    static template = `const C = this.C; <C>{this.get('children')}</C>`;
                    C = C;
                }

                const instance = renderApp(function() {
                    return (
                        <div>
                            {this.state.count}
                            <F>
                                <p>
                                    {this.state.count}
                                    <E>
                                        test{this.state.count}
                                    </E>
                                </p>
                            </F>
                        </div>
                    );
                }, {count: 1});

                act(() => {
                    instance.setState({count: 2});
                });
                expect(mount.callCount).to.eql(1);
                expect(update.callCount).to.eql(1);
            });

            it('should get children in intact component', () => {
                class C extends Component<{first?: boolean}> {
                    static template = `<div>{this.get('children')}</div>`;
                    init() {
                        const {children, first} = this.get();
                        if (first) {
                            expect((children as VNode).tag === C).to.be.true;
                        }
                    }
                }
                const instance = renderApp(function() {
                    return <C first={true}><C>test</C></C>
                });
            });

            it('should get key', () => {
                class C extends Component<{first?: boolean}> {
                    static template = `<div>{this.get('children')}</div>`;
                    init() {
                        const {key, first} = this.get();
                        if (!first) {
                            expect(key).to.eql('a');
                        }
                    }
                }
                const instance = renderApp(function() {
                    return <C first={true}><C key="a">test</C></C>
                });
            })
        });

        describe('Validate', () => {
            it('should validate props', () => {
                const [spyError, resetError] = getSpyError();
                class IntactComponent extends Component<{show?: any}> {
                    static template = `<div>{this.get('children')}</div>`
                    static typeDefs = {
                        show: Boolean,
                    }
                }
                class IntactComponent2 extends IntactComponent {

                }
                render(
                    <div>
                        <IntactComponent show={1}>
                            <IntactComponent2 show={1} />
                        </IntactComponent>
                    </div>
                );

                expect(spyError.callCount).to.eql(2);
                resetError();
            });
        });

        describe('Provide & Inject', () => {
            it('should inject conrrectly', () => {
                class A extends Component {
                    static template(this: A) {
                        return h('div', null, this.get('children'));
                    }

                    init() {
                        provide('number', 1);
                    }
                }

                class B extends Component {
                    static template = () => {
                        return h('div', null, 'b');
                    }

                    public number = inject('number');

                    init() {
                        expect(inject('number')).to.equal(1);
                    }
                }

                render(
                    <div>
                        <A />
                        <A><B /></A>
                        <A><div><B /></div></A>
                    </div>
                );
            });
        });
    });
});
