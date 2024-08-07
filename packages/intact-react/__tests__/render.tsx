import {
    render,
    container,
    createIntactComponent, 
    SimpleIntactComponent,
    ChildrenIntactComponent,
    SimpleReactComponent,
    PropsIntactComponent,
    expect,
    renderApp,
} from './helpers';
import {
    Component,
    createVNode as h,
    findDomFromVNode,
    Props,
    VNode,
    directClone,
    createVNode,
    normalize,
    render as intactRender,
    mount,
    VNodeComponentClass,
    IntactDom,
    createCommentVNode,
} from '../src';
import {Component as ReactComponent, ReactNode, Fragment, useState, useEffect} from 'react';
import ReactDOM from 'react-dom';
import {dispatchEvent} from '../../misstime/__tests__/utils';
import {Portal} from './portal';
import {act} from 'react-dom/test-utils';
import { View } from './view';

describe('Intact React', () => {
    describe('Render', () => {
        it('render intact component in react', () => {
            render(<SimpleIntactComponent />);
            expect(container.innerHTML).to.eq('<div>Intact Component</div>');
        });

        it('render intact component in react element', () => {
            render(<div><SimpleIntactComponent /></div>);
            expect(container.innerHTML).to.eq('<div><div>Intact Component</div></div>');
        });

        it('render intact component in react component', () => {
            render(<SimpleReactComponent><SimpleIntactComponent /></SimpleReactComponent>);
            expect(container.innerHTML).to.eq('<div><div>Intact Component</div></div>');
        });

        it('render react element in intact component', () => {
            render(<ChildrenIntactComponent><div>test</div></ChildrenIntactComponent>);
            expect(container.innerHTML).to.eql('<div><div>test</div>#</div>');
        });

        it('render react component in intact component', () => {
            render(
                <ChildrenIntactComponent>
                    <SimpleReactComponent>test1</SimpleReactComponent>
                    <SimpleReactComponent>test2</SimpleReactComponent>
                </ChildrenIntactComponent>
            );
            expect(container.innerHTML).to.eql('<div><div>test1</div>#<div>test2</div>#</div>');
        });

        it('render nested react and intact component', () => {
            render(
                <ChildrenIntactComponent>
                    <SimpleReactComponent>
                        <ChildrenIntactComponent>test</ChildrenIntactComponent>
                    </SimpleReactComponent>
                </ChildrenIntactComponent>
            );
            expect(container.innerHTML).to.eql('<div><div><div>test</div></div>#</div>');
        });

        it('render with props', () => {
            render(<PropsIntactComponent a="a" b={1} />);
            expect(container.innerHTML).to.eql('<div>a: a b: 1</div>');
        });

        it('render react element with event', () => {
            const click = sinon.spy((event: Event) => {
                console.log('click', event);
                expect((event.target as HTMLElement).tagName).to.eql('DIV');
            });
            render(
                <ChildrenIntactComponent>
                    <div onClick={click} onMouseDown={click}>click</div>
                    <div onClick={click}>click</div>
                </ChildrenIntactComponent>
            );

            (container.firstElementChild!.firstElementChild! as HTMLElement).click();
            expect(click.callCount).to.eql(1);
        });

        it('render react element with mouseenter event', () => {
            const fn = sinon.spy((event: Event) => {
                console.log('mouseenter', event);
                expect((event.target as HTMLElement).tagName).to.eql('DIV');
            });
            let dom: HTMLElement | null = null;
            render(
                <div>
                    <div>
                        <ChildrenIntactComponent>
                            <div onMouseEnter={fn} ref={(i: HTMLElement | null) => dom = i}>event</div>
                        </ChildrenIntactComponent>
                    </div>
                </div>
            );

            dispatchEvent(dom!, 'mouseover');
            expect(fn.callCount).to.eql(1);
        });

        it('render event of react element that return by intact component directly', () => {
            const click = sinon.spy((event: Event) => {
                console.log('click', event);
                expect((event.target as HTMLElement).tagName).to.eql('SPAN');
            });
            class Test extends Component {
                static template = `<template>{this.get('children')}</template>`;
            }
            render(<Test><span onClick={click}>click</span></Test>);

            (container.firstElementChild! as HTMLElement).click();
            expect(click.callCount).to.eql(1);
        });

        it('render event of react and it can stop propagation', () => {
            const click1 = sinon.spy((event: Event) => {
                console.log('Click in React.', event);
                event.stopPropagation();
                (event as any).nativeEvent.stopImmediatePropagation();
            });
            const click2 = sinon.spy(() => {
                console.log('Click in Intact.');
            });
            class Test extends Component {
                static template = `<div ev-click={this.click}>{this.get('children')}</div>`;
                click() {
                    click2();
                }
            }
            render(<Test><span onClick={click1}>click</span></Test>);

            (container.firstElementChild!.firstElementChild as HTMLElement).click();
            expect(click1.callCount).to.eql(1);
            expect(click2.callCount).to.eql(0);
        });

        it('should stop propagation when bind event to intact component', () => {
            class Test extends Component<{}, { click: [Event] }> {
                static template = `<div ev-click={this.click.bind(this)}>{this.get('children')}</div>`;

                click(e: Event) {
                    this.trigger('click', e);
                }
            }

            const outer = sinon.spy(() => {
                console.log('click outer');
            });
            const inner = sinon.spy((e: Event) => {
                e.stopPropagation();
                console.log('click inner')
            });
            render(
                <Test onClick={outer}>
                    <Test onClick={inner}>
                        click
                    </Test>
                </Test>
            );


            (container.firstElementChild!.firstElementChild as HTMLElement).click();
            expect(inner.callCount).to.eql(1);
            expect(outer.callCount).to.eql(0);
        });

        it('should not affect intact component when parent react element stopPropagation', () => {
            const outer = sinon.spy((e: Event) => {
                e.stopPropagation();
                console.log('click outer');
            });
            const inner = sinon.spy((e: Event) => {
                console.log('click inner')
            });
            const top = sinon.spy(() => {
                console.log('click top');
            });

            class Test extends Component {
                static template = `<div ev-click={this.click.bind(this)}>{this.get('children')}</div>`;

                click(e: Event) {
                    inner();
                }
            }

            render(
                <View onClick={top} className="a">
                    <View onClick={outer}>
                        <Test>
                            click
                        </Test>
                    </View>
                </View>
            );

            (container.firstElementChild!.firstElementChild!.firstElementChild as HTMLElement).click();
            expect(inner.callCount).to.eql(1);
            expect(outer.callCount).to.eql(1);
            expect(top.callCount).to.eql(0);
        });

        it('render React component that return intact component', () => {
            const Test = (props: { a: string }) => {
                return <PropsIntactComponent a={props.a} />
            }
            render(
                <ChildrenIntactComponent>
                    <Test a="1" />
                    <Test a="2" />
                </ChildrenIntactComponent>
            );

            expect(container.innerHTML).to.eql('<div><div>a: 1 b: </div>#<div>a: 2 b: </div>#</div>')
        });

        it('outer react element should receive event', () => {
            const click = sinon.spy((event: Event) => {
                console.log('Click in React.', event);
            });

            render(
                <div onClick={click}>
                    <ChildrenIntactComponent>
                        <span onClick={click}>click</span>
                    </ChildrenIntactComponent>
                </div>
            );

            const trigger = container.querySelector('span') as HTMLSpanElement;
            trigger.click();
            expect(click.callCount).to.eql(2);
        });

        it('bind onMouseLeave event on react element rendered in intact component and update state', () => {
            const App = function() {
                const [count, setCount] = useState(0);

                return (
                    <div onMouseEnter={() => setCount(count + 1)}>
                        <ChildrenIntactComponent>
                            <div onMouseLeave={() => setCount(count + 1)} className="trigger">{count}</div>
                        </ChildrenIntactComponent>
                    </div>
                );
            };

            render(<App />);

            const dom = container.querySelector('.trigger') as HTMLDivElement;
            dispatchEvent(dom, 'mouseover');
            dispatchEvent(dom, 'mouseout');
            expect(container.innerHTML).to.eql('<div><div><div class="trigger">2</div>#</div></div>');
        });

        describe('Portal', () => {
            class Dialog extends Component<{show?: boolean}> {
                static template = `const Portal = this.Portal;
                    <Portal><div class="k-dialog">{this.get('show') ? this.get('children') : null}</div></Portal>
                `
                static defaults() {
                    return { show: true };
                }

                private Portal = Portal;
            }


            it('react element is in Portal directly', () => {
                const click = sinon.spy((event: Event) => {
                    console.log('Click in React.', event);
                });
                render(
                    <div>
                        <Dialog>
                            <span onClick={click}>click</span>
                        </Dialog>
                    </div>
                );
                container.nextElementSibling!.querySelector('span')!.click();
                expect(click.callCount).to.eql(1);
            });

            it('react element nested in Intact is in Portal', () => {
                const click = sinon.spy((event: Event) => {
                    console.log('Click in React.', event);
                });
                render(
                    <div>
                        <Dialog>
                            <ChildrenIntactComponent>
                                <span onClick={click}>click</span>
                            </ChildrenIntactComponent>
                        </Dialog>
                    </div>
                );
                container.nextElementSibling!.querySelector('span')!.click();
                expect(click.callCount).to.eql(1);
            });
       
            it('render event nested in react element in Intact Portal', () => {
                const click = sinon.spy((event: Event) => {
                    console.log('Click in React.', event);
                });
                render(
                    <div>
                        <Dialog>
                            <div>
                                <ChildrenIntactComponent>
                                    <span onClick={click}>click</span>
                                </ChildrenIntactComponent>
                            </div>
                        </Dialog>
                    </div>
                );

                container.nextElementSibling!.querySelector('span')!.click();
                expect(click.callCount).to.eql(1);
            });

            it('render event in Intact Portal with sibling react element', () => {
                const click = sinon.spy((event: Event) => {
                    console.log('Click in React.', event);
                });

                render(
                    <div>
                        <Dialog>
                            <p>test</p>
                            <ChildrenIntactComponent>
                                <span onClick={click}>click</span>
                            </ChildrenIntactComponent>
                        </Dialog>
                    </div>
                );

                container.nextElementSibling!.querySelector('span')!.click();
                expect(click.callCount).to.eql(1);
            });

            it('render children after mounted', () => {
                const click = sinon.spy((event: Event) => {
                    console.log('Click in React.', event);
                });

                const instance = renderApp(function() {
                    return <div>
                        <Dialog>
                            {this.state.show ?
                                <>
                                    <p>test</p>
                                    <ChildrenIntactComponent>
                                        <span onClick={click}>click</span>
                                    </ChildrenIntactComponent>
                                </> :
                                null
                            }
                        </Dialog>
                    </div>
                }, { show: false });

                act(() => {
                    instance.setState({show: true});
                });

                container.nextElementSibling!.querySelector('span')!.click();
                expect(click.callCount).to.eql(1);
            });

            it('remove portal before call mounted', () => {
                const unmounted = sinon.spy(() => console.log('unmounted'));
                class Child extends Component {
                    static template = `<div>child</div>`;
                    mounted() {
                        console.log('mounted');
                    }
                    unmounted() {
                        unmounted();
                    }
                }
                function Foo({change}: {change: (v: number) => void}) {
                    const [state, setState] = useState(1);
                    useEffect(() => {
                        change(state); 
                    }, [state]);

                    return <div className="foo">foo</div>
                }
                function Baz() {
                    return <Dialog><Child /></Dialog>
                }
                function Qux() {
                    return <ChildrenIntactComponent><div className="qux">test</div></ChildrenIntactComponent>
                }
                function Bar() {
                    const [count, setCount] = useState(0);

                    return <div className="bar">
                        <ChildrenIntactComponent>
                            <Foo change={setCount} />
                            <Qux />
                        </ChildrenIntactComponent>
                        {count !== 1 && <Baz />}
                    </div>
                }
                function App() {
                    return <ChildrenIntactComponent>
                        <Bar />
                    </ChildrenIntactComponent>
                }

                render(<App />);

                expect(unmounted.callCount).to.eql(1);
            });

            it('should remove prepared element if we do not render any react element', () => {
                render(<Dialog />);
                expect(container.nextElementSibling!.innerHTML).to.eql('');
            });
        });

        it('render nested array children', () => {
            render(
                <ChildrenIntactComponent>
                    {[1, 2].map(item => <div key={item}>{item}</div>)}
                    <div>3</div>
                </ChildrenIntactComponent>
            );
            expect(container.innerHTML).to.eql('<div><div>1</div>#<div>2</div>#<div>3</div>#</div>');
        });

        it('render react component which return null', () => {
            function Null() {
                return null;
            }
            function NotNull() {
                return <div>test</div>
            }

            const root = render(
                <ChildrenIntactComponent>
                    <NotNull />
                    <Null />
                </ChildrenIntactComponent>
            );
            expect(container.innerHTML).to.eql('<div><div>test</div>##</div>');

            root.render(
                <ChildrenIntactComponent>
                    <NotNull />
                </ChildrenIntactComponent>
            );
            expect(container.innerHTML).to.eql('<div><div>test</div>#</div>');

            root.render(
                <ChildrenIntactComponent>
                    <Null />
                    <NotNull />
                </ChildrenIntactComponent>,
            );
            expect(container.innerHTML).to.eql('<div>#<div>test</div>#</div>');

            root.render(
                <ChildrenIntactComponent>
                    <NotNull />
                </ChildrenIntactComponent>,
            );
            expect(container.innerHTML).to.eql('<div><div>test</div>#</div>');
        });

        it('render nested intact component in react element', () => {
            render(
                <ChildrenIntactComponent>
                    <section>
                        <ChildrenIntactComponent>
                            <span>test</span>
                        </ChildrenIntactComponent>
                    </section>
                </ChildrenIntactComponent>
            );
        });

        it('render async inatct component', () => {
            class Test extends Component {
                static template = `<div>test</div>`;
                init() {
                    return new Promise<void>(resolve => {
                        resolve();
                    });
                }
            }
            render(<Test />);
            expect(container.innerHTML).to.eql('<div>test</div>');
        });

        it('render component that returns multipe vNodes', () => {
            class Test extends Component {
                static $doubleVNodes = true;
                static template = `<template><div>1</div><div>2</div></template>`;
            }

            render(<Test />);
            expect(container.innerHTML).to.eql('<div>1</div><div>2</div>');
        });

        it('should render new props those are added in intact', () => {
            const onClick = sinon.spy(() => console.log('click'));
            class Test extends Component {
                static template(this: Test) {
                    const children = directClone(this.get('children') as VNode);
                    const props = {
                        'ev-click': onClick,
                        className: 'test',
                        ...children.props,
                    };
                    children.props = props;

                    return children;
                }
            }
            render(<Test><div onClick={(e) => console.log(e)}>click</div></Test>);
            expect(container.innerHTML).to.eql('<div class="test">click</div>#');

            (container.firstElementChild as HTMLDivElement).click();
            expect(onClick.callCount).to.eql(1);
        });

        it('render intact component before react text node', () => {
            render(
                <div>
                    <ChildrenIntactComponent>
                        intact
                    </ChildrenIntactComponent>
                    text
                </div>
            );

            expect(container.innerHTML).to.eql('<div><div>intact</div>text</div>')
        });

        it('render react element without parentComponent', async() => {
            class Dialog extends Component<{content: any}> {
                static template = `<div>{this.get('content')}</div>`;
            }

            const click = sinon.spy(() => {
                console.log('click');
            });

            const vNode = createVNode(Dialog, {
                content: normalize(<span onClick={click}>without parentComponent</span>)
            });
            const container = document.createElement('div');
            document.body.appendChild(container);

            render(<div><SimpleReactComponent /></div>);
            intactRender(vNode, container);

            expect(container.innerHTML).to.eql('<div><span>without parentComponent</span>#</div>');
            container.querySelector<HTMLElement>('span')!.click();
            expect(click.callCount).to.eql(1);
        });

        describe('Normalize', () => {
            it('normalize events', () => {
                type Props = {value: number};
                type Events = {
                    click: []
                    change: []
                    'click:value': []
                    clickValue: []
                }
                class C<T extends Props> extends Component<T, Events> {
                    static template = `<div ev-click={this.onClick.bind(this)}
                        ev-mouseenter={this.get('ev-mouseenter')}
                    >click {this.get('value')}</div>`;

                    static events = {
                        clickValue: true,
                    };

                    onClick() {
                        this.set('value', this.get('value') + 1);
                        this.trigger('click');
                        this.trigger('change');
                        this.trigger('click:value');
                        this.trigger('clickValue');
                    }
                }

                const click = sinon.spy(() => console.log('click'));
                const changeValue = sinon.spy(() => console.log('changeValue'));
                const change = sinon.spy(() => console.log('change'));
                const enter = sinon.spy(() => console.log('enter'));

                render(<div><C onClick={click} on$change-value={changeValue} value={0} /></div>);
                (container.firstElementChild!.firstElementChild! as HTMLElement).click();
                // expect(click.callCount).to.eql(1);
                // expect(changeValue.callCount).to.eql(1);

                // render(
                    // <div>
                        // <C 
                            // onChangeValue={changeValue}
                            // onChange={change}
                            // onClick-value={click}
                            // onClickValue={click}
                            // value={0}
                            // onMouseEnter={enter}
                        // />
                    // </div>
                // );
                // const element = container.firstElementChild!.firstElementChild! as HTMLElement;
                // element.click();
                // expect(changeValue.callCount).to.eql(2);
                // expect(change.callCount).to.eql(1);
                // expect(click.callCount).to.eql(3);

                // dispatchEvent(element, 'mouseenter');
                // expect(enter.callCount).to.eql(1);
            });

            it('normalize blocks', () => {
                class C extends Component<{}, {}, {footer: null}> {
                    static template = (`<div>{this.get('children')}<b:footer /></div>`);
                }

                render(<C slotFooter={<span>footer</span>}>children</C>);
                expect(container.innerHTML).to.eql('<div>children<span>footer</span>#</div>');

                render(<C slotFooter={'footer'}>children</C>);
                expect(container.innerHTML).to.eql('<div>childrenfooter</div>');
            });

            it('normalize scope blocks', () => {
                class C extends Component<{}, {}, {footer: number}> {
                    static template = (`<div>{this.get('children')}<b:footer params={1} /></div>`);
                }
                render(<C slotFooter={(i: number) => <span>footer{i}</span>}>children</C>);

                expect(container.innerHTML).to.eql('<div>children<span>footer1</span>#</div>');
            });

            it('normalize the property which value is vNodes', () => {
                class C extends Component<{test: ReactNode}> {
                    static template = `<div>{this.normalize(this.get('test'))}</div>`
                    private normalize = Component.normalize;
                }
                render(<C test={<div>test</div>} />);

                expect(container.innerHTML).to.eql('<div><div>test</div>#</div>');
            });

            it('normalize React.Fragment', () => {
                class C extends Component {
                    static template = `<div>{this.get('children')}</div>`;
                }
                render(<C><>react</></C>);
            });
            it('normalize props for undefined', () => {
                class C extends Component<{}, {}, {prepend: null}> {
                    static template = `<div>children<b:prepend />{$blocks.prepend ? 'pre' : ''}</div>`;
                }

                render(<C slotPrepend={undefined}>children</C>);
                expect(container.innerHTML).to.eql('<div>children</div>');
            });
        });

        describe('Functional Component', () => {
            it('render intact functional component', () => {
                const Test = Component.functionalWrapper(function(props) {
                    return h(ChildrenIntactComponent, props);
                });
                render(<Test>test</Test>);
                expect(container.innerHTML).to.eql('<div>test</div>');

                const Tests = Component.functionalWrapper(function(props) {
                    return [
                        h(ChildrenIntactComponent, props),
                        h(ChildrenIntactComponent, props),
                    ];
                });
                render(<Tests>test<i>test</i></Tests>);
                expect(container.innerHTML).to.eql('<div>test<i>test</i>#</div><div>test<i>test</i>#</div>');

                render(<div><Tests>test1</Tests><Tests>test2</Tests></div>);
                expect(container.innerHTML).to.eql('<div><div>test1</div><div>test1</div><div>test2</div><div>test2</div></div>');
            });

            it('render intact functional component with forwardRef', () => {
                const Test = Component.functionalWrapper(function(props) {
                    return h(ChildrenIntactComponent, props);
                });
                let instance;
                render(<Test ref={(i: any) => instance = i}>test</Test>);
                expect(instance).be.instanceof(ChildrenIntactComponent);
            });

            it('render block to intact functional component', () => {
                class Demo extends Component<{}, {}, {test: null}> {
                    static template = `<div><b:test /></div>`;
                }
                const Test = Component.functionalWrapper(function(props: Props<{slotTest: null}, Demo>) {
                    return h(Demo, props);
                });
                render(<Test slotTest={<span>test</span>} />);
                expect(container.innerHTML).to.eql('<div><span>test</span>#</div>');
            });

            it('render block to firsthand intact component', () => {
                const C = createIntactComponent<{}, {}, {test: number}>(
                    `<div><b:test params={1} />{this.get('children')}</div>`
                );
                render(
                    <ChildrenIntactComponent>
                        <C slotTest={(v: any) => <div>{v}</div>}>
                            <div>2</div>
                        </C>
                    </ChildrenIntactComponent>
                );
                expect(container.innerHTML).to.eql('<div><div><div>1</div>#<div>2</div>#</div></div>');
            });

            it('render block witch value is text node', () => {
                const C = createIntactComponent<{}, {}, {test: null}>(
                    `<div><b:test />{this.get('children')}</div>`
                );
                render(<C slotTest={<Fragment>test</Fragment>} />);
                expect(container.innerHTML).to.eql('<div>test</div>');
            });

            it('render intact functional component which has wrapped in intact component', () => {
                const Test1 = Component.functionalWrapper(function(props) {
                    return h(ChildrenIntactComponent, props);
                });
                class Test2 extends Component {
                    static template = `const {Test1} = this; <Test1>test</Test1>`;
                    Test1 = Test1;
                }
                render(<Test2 />);
                expect(container.innerHTML).to.eql('<div>test</div>');
            });

            it('render intact component which return the react children directly', () => {
                const C = createIntactComponent(`<template>{this.get('children')}</template>`);
                let instance1: any;
                let instance2: any;
                render(
                    <C ref={(i: any) => {instance1 = i}}>
                        <C ref={(i: any) => {instance2 = i}}>
                            <div>test</div>
                        </C>
                    </C>
                );
                const element1 = findDomFromVNode(instance1.$vNode, true) as HTMLElement;
                const element2 = findDomFromVNode(instance2.$vNode, true) as HTMLElement;
                expect(element1.outerHTML).to.eql('<div>test</div>');
                expect(element1).to.eql(element2);
            });
        });
    });
});
