import {
    render,
    container,
    createIntactComponent, 
    SimpleIntactComponent,
    ChildrenIntactComponent,
    SimpleReactComponent,
    PropsIntactComponent,
    expect,
} from './helpers';
import {Component, createVNode as h, findDomFromVNode} from '../src';
import {Component as ReactComponent, ReactNode, Fragment} from 'react';
import ReactDOM from 'react-dom';

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

            render(
                <ChildrenIntactComponent>
                    <NotNull />
                    <Null />
                </ChildrenIntactComponent>
            );
            expect(container.innerHTML).to.eql('<div><div>test</div>##</div>');

            ReactDOM.render(
                <ChildrenIntactComponent>
                    <NotNull />
                </ChildrenIntactComponent>,
                container
            );
            expect(container.innerHTML).to.eql('<div><div>test</div>#</div>');

            ReactDOM.render(
                <ChildrenIntactComponent>
                    <Null />
                    <NotNull />
                </ChildrenIntactComponent>,
                container
            );
            expect(container.innerHTML).to.eql('<div>#<div>test</div>#</div>');

            ReactDOM.render(
                <ChildrenIntactComponent>
                    <NotNull />
                </ChildrenIntactComponent>,
                container
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

        describe('Normalize', () => {
            it('normalize events', () => {
                class C extends Component<{onClick: Function, value?: number, on: string}> {
                    static template = `<div ev-click={this.onClick.bind(this)}>click {this.get('on')}</div>`;

                    onClick() {
                        this.set('value', 1);
                        this.trigger('click');
                    }
                }

                const click = sinon.spy(() => console.log('click'));
                const change = sinon.spy(() => console.log('change'));
                render(<div><C onClick={click} on$change-value={change} on="1"/></div>);

                (container.firstElementChild!.firstElementChild! as HTMLElement).click();
                expect(container.innerHTML).to.eql('<div><div>click 1</div></div>');
                expect(click.callCount).to.eql(1);
                expect(change.callCount).to.eql(1);
            });

            it('normalize bloks', () => {
                class C extends Component {
                    static template = (`<div>{this.get('children')}<b:footer /></div>`);
                }

                render(<C slot-footer={<span>footer</span>}>children</C>);
                expect(container.innerHTML).to.eql('<div>children<span>footer</span>#</div>');

                render(<C slot-footer={'footer'}>children</C>);
                expect(container.innerHTML).to.eql('<div>childrenfooter</div>');
            });

            it('normalize scope blocks', () => {
                class C extends Component {
                    static template = (`<div>{this.get('children')}<b:footer params={1} /></div>`);
                }
                render(<C slot-footer={(i: number) => <span>footer{i}</span>}>children</C>);

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
                class Demo extends Component {
                    static template = `<div><b:test /></div>`;
                }
                const Test = Component.functionalWrapper(function(props) {
                    return h(Demo, props);
                });
                render(<Test slot-test={<span>test</span>} />);
                expect(container.innerHTML).to.eql('<div><span>test</span>#</div>');
            });

            it('render block to firsthand intact component', () => {
                const C = createIntactComponent(`<div><b:test params={1} />{this.get('children')}</div>`);
                render(
                    <ChildrenIntactComponent>
                        <C slot-test={(v: any) => <div>{v}</div>}>
                            <div>2</div>
                        </C>
                    </ChildrenIntactComponent>
                );
                expect(container.innerHTML).to.eql('<div><div><div>1</div>#<div>2</div>#</div></div>');
            });

            it('render block witch value is text node', () => {
                const C = createIntactComponent(`<div><b:test />{this.get('children')}</div>`);
                render(<C slot-test={<Fragment>test</Fragment>} />);
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
