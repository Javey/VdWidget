import Vue from 'vue';
import Test from './test1.vue';
import {Component, createVNode as h, directClone, VNode} from '../src';
import {
    dispatchEvent,
    createIntactComponent,
    SimpleIntactComponent,
    ChildrenIntactComponent,
    PropsIntactComponent,
    vm,
    render,
    reset,
    nextTick,
} from './helpers';
import Normalize from './normalize.vue';
import { Portal } from './portal';

describe('Intact Vue Legacy', () => {
    describe('Render', () => {
        it('render intact componnet in vue', async () => {
            render('<C />', {C: SimpleIntactComponent});
            expect(vm.$el.outerHTML).to.eql(SimpleIntactComponent.template);
        });

        it('render nested intact component', () => {
            render(`<C><C>test</C></C>`, {C: ChildrenIntactComponent});
            expect(vm.$el.outerHTML).to.eql(`<div><div>test</div></div>`);
        });

        it('render intact in vue element', () => {
            render('<div><C/></div>', {C: SimpleIntactComponent});
            expect(vm.$el.outerHTML).to.eql(`<div>${SimpleIntactComponent.template}</div>`);
        });

        it('render intact in vue component', () => {
            render(
                '<VueComponent><C/></VueComponent>',
                {
                    VueComponent: {
                        template: `<div><slot></slot></div>`
                    },
                    C: SimpleIntactComponent
                }
            );

            expect(vm.$el.outerHTML).to.eql(`<div>${SimpleIntactComponent.template}</div>`);
        });

        it('render vue element in intact', () => {
            render('<C><div>vue</div></C>', {C: ChildrenIntactComponent});
            expect(vm.$el.outerHTML).to.eql(`<div><div>vue</div></div>`);
        });

        it('render vue component in intact', () => {
            render('<C><VueComponent /></C>', {
                C: ChildrenIntactComponent,
                VueComponent: {
                    template: `<div>vue component</div>`
                }
            });
            expect(vm.$el.outerHTML).to.eql(`<div><div>vue component</div></div>`);
        });

        it('render nested vue and intact', () => {
            render('<C><V><C><V></V></C></V></C>', {
                C: ChildrenIntactComponent,
                V: {
                    template: `<div><slot></slot></div>`
                }
            });
            expect(vm.$el.outerHTML).to.eql(`<div><div><div><div></div></div></div></div>`);
        });

        it('render nested component in template', () => {
            render('<C class="a"><V><div></div></V></C>', {
                C: ChildrenIntactComponent,
                V: {
                    template: `<C class="b"><slot></slot></C>`,
                    components: {
                        C: ChildrenIntactComponent,
                    }
                }
            });

            expect(vm.$el.outerHTML).to.eql(`<div class="a"><div class="b"><div></div></div></div>`);
        });

        it('render with props', () => {
            render('<C a="a" :b="b" />', {
                C: PropsIntactComponent
            }, {b: 1});

            expect(vm.$el.outerHTML).to.eql('<div>a: a b: 1</div>');
        });

        it('render Boolean type prop', () => {
            class Test extends Component {
                static template = `
                    var data = {
                        a: this.get('a'),
                        b: this.get('b'),
                        c: this.get('c'),
                        d: this.get('d')
                    };
                    <div>{JSON.stringify(data)}</div>
                `;

                static typeDefs = {
                    a: Boolean,
                    b: {
                        type: Boolean,
                        required: true,
                    },
                    c: [Number, Boolean],
                    d: {
                        type: [Number, Boolean],
                        required: true,
                    }
                };
            }

            render('<C a b c d="d" />', {C: Test});
            expect(vm.$el.outerHTML).to.eql('<div>{"a":true,"b":true,"c":true,"d":true}</div>');
        });

        it('render with event', async () => {
            class Test extends Component<{}, {click: []}> {
                static template = `<div ev-click={this.onClick.bind(this)}>click</div>`;
                onClick() {
                    this.trigger('click')
                }
            }
            render('<div><C @click="onClick" />{{ a }}</div>', {
                C: Test 
            }, {a: 1}, {
                onClick(this: any) {
                    this.a++;
                }
            });

            dispatchEvent(vm.$el.firstElementChild!, 'click');
            await nextTick();
            expect(vm.$el.outerHTML).be.eql('<div><div>click</div>2</div>');
        });

        describe('Change Event', () => {
            async function test(name: string) {
                const changeValue = sinon.spy();
                class IntactComponent extends Component<{priceAmount: number}, {change: []}> {
                    static template = `<div ev-click={this.onClick.bind(this)}>{this.get('priceAmount')}</div>`;
                    onClick() {
                        this.set('priceAmount', this.get('priceAmount') + 1);
                        this.trigger('change');
                    }
                }

                render(`<C ${name}="changeValue" :priceAmount.sync="priceAmount" />`, {
                    C: IntactComponent 
                }, {priceAmount: 1}, {changeValue});

                dispatchEvent(vm.$el, 'click');
                await nextTick();
                expect(changeValue.callCount).to.eql(1);
                expect((vm as any).priceAmount).to.eql(2);
            }

            it('name with colon', async () => {
                await test('@change:priceAmount');
            });

            it('name without colon', async () => {
                await test('@changePriceAmount');
            });

            it('name without hyphen', async () => {
                await test('@change-price-amount');
            });

            it('raw change', async () => {
                await test('@change');
            });
        });

        it('render with multiple events which event names are the same', async () => {
            const click = sinon.spy(() => console.log('click'));
            const changeValue = sinon.spy();
            class IntactComponent extends Component<{value: string}, {click: []}> {
                static template = `<div ev-click={this.onClick.bind(this)}>{this.get('value')}</div>`;
                onClick() {
                    this.set('value', 'click');
                    this.trigger('click');
                }
            }
            render('<div><C @click.native="click" v-model="value" />{{ value }}</div>', {
                C: Vue.extend({
                    template: `<IntactComponent v-model="value1"
                        @click="click"
                        @input="changeValue"
                        @change:value="changeValue"
                    />`,
                    components: {
                        // IntactComponent: {
                            // template: `<div>test</div>`,
                            // // props: {
                                // // value: {
                                    // // required: true, 
                                // // }
                            // // }
                        // },
                        IntactComponent,
                    },
                    methods: {click, changeValue},
                    props: {
                        value: {
                            required: true
                        }
                    },
                    data() {
                        return {
                            value1: this.value
                        }
                    },
                    watch: {
                        value1(v) {
                            this.$emit('input', v);
                        }
                    }
                })
            }, {value: "test"}, {click});

            dispatchEvent(vm.$el.firstElementChild!, 'click');
            await nextTick();
            expect(vm.$el.outerHTML).to.eql('<div><div>click</div>click</div>');
            expect(click.callCount).to.eql(2);
            expect(changeValue.callCount).to.eql(2);
        });

        it('render with slots', () => {
            class Test extends Component {
                static template = `<div>{this.get('children')}<b:footer></b:footer></div>`;
            }
            render('<C><template slot="footer"><div>footer</div></template><div>children</div></C>', {
                C: Test
            });

            expect(vm.$el.outerHTML).be.eql('<div><div>children</div><div>footer</div></div>');
        });

        it('render undefined slot', () => {
            class Test extends Component {
                static template = `<div>{this.get('children')}</div>`;
            }
            render('<C><template #footer><div><C>test</C></div></template></C>', {
                C: Test 
            });

            expect(vm.$el.outerHTML).be.eql('<div></div>');
            reset();

            render('<C><C><template slot="footer"><div>test</div></template></C></C>', {
                C: Test
            });

            expect(vm.$el.outerHTML).be.eql('<div><div></div></div>');
        });

        it('render with scoped slots', () => {
            render('<C><template slot-scope="{test}"><div>{{ test }}</div></template></C>', {
                // C: createIntactComponent(`<div>{self.get('default')('test')}</div>`)
                C: createIntactComponent(`<div><b:default params={{test: 'test'}} /></div>`)
            });

            expect(vm.$el.outerHTML).be.eql('<div><div>test</div></div>');
        });

        it('should silent when we try to treat a default scope slot as children', () => {
            const consoleWarn = console.error;
            const warn = console.warn = sinon.spy();

            render(`<C><template slot-scope="item">{{ item.a }}</template></C>`, {
                C: createIntactComponent(`<div><b:default params={{a: 1}} /></div>`)
            });

            expect(vm.$el.outerHTML).to.eql('<div>1</div>');
            expect(warn.callCount).to.eql(0);
            console.error = consoleWarn;
        });

        it('ignore empty slot in vue, this is the default behavior of vue', () => {
            render('<C><template slot="slot"></template></C>', {
                C: createIntactComponent(`<div><b:slot>test</b:slot></div>`)
            });

            expect(vm.$el.outerHTML).be.eql('<div>test</div>');
        });

        it('render style and class', () => {
            render(`<C style="color: red;" :style="{fontSize: '12px'}" class="a" :class="{b: true}"/>`, {
                C: createIntactComponent(`<div style={{...this.get('style'), fontWeight: "bold"}} class={this.get('className') + ' c'}>test</div>`)
            });

            expect(vm.$el.outerHTML).be.eql('<div class="a b c" style="color: red; font-size: 12px; font-weight: bold;">test</div>');
        });

        it('render async intact component', () => {
            class Test extends Component {
                static template = `<div>test</div>`;
                init() {
                    return new Promise<void>((resolve) => {
                        resolve();
                    });
                }
            }
            render('<C />', {
                C: Test 
            });

            expect(vm.$el.outerHTML).be.eql('<div>test</div>');
        });

        it('render nested array children', () => {
            class Test extends Component {
                static template = `<div>{this.get('content')}</div>`;
            }
            render(function(h) {
                const content = Component.normalize([
                    h('div', '1'),
                    [
                        h('div', '2'),
                        h('div', '3')
                    ]
                ]);
                return h(Test, {attrs: {content}});
            });

            expect(vm.$el.outerHTML).to.eql('<div><div>1</div><div>2</div><div>3</div></div>');
        });

        it('render normalize vNode with propperty', async () => {
            const consoleError = console.error;
            const error = console.error = sinon.spy((...args: any[]) => consoleError.call(console, ...args));

            const C = Normalize;
            // no [Vue warn]
            render(function(h) {
                return h(C);
            });

            await nextTick();
            expect(vm.$el.outerHTML).to.eql('<div><div>test</div><div></div></div>');
            expect(error.callCount).to.eql(0);
            console.error = consoleError;
        });

        it('render vue vNodes as children', () => {
            render('<C :children="children" />', {
                C: ChildrenIntactComponent
            }, function() {
                const h = this.$createElement;
                return {
                    children: Component.normalize(h('div', 'test'))
                }
            });

            expect(vm.$el.outerHTML).to.eql('<div><div>test</div></div>');
        });

        it('render props which name is hyphenated style', () => {
            class Test extends Component<{}, {clickComponent: []}> {
                static template = `<div ev-click={this.click.bind(this)}>{this.get('userName')}</div>`;
                static typeDefs = {
                    userName: String
                };
                click() {
                    this.trigger('clickComponent');
                }
            }
            const click = sinon.spy(() => console.log('click'));
            render('<C user-name="Javey" @click-component="click" />', {
                C: Test,
            }, {}, {click});

            expect(vm.$el.outerHTML).to.eql('<div>Javey</div>');
            (vm.$el as HTMLElement).click();
            expect(click.callCount).to.eql(1);
        });

        it('render component that returns multiple vNodes', () => {
           class Test extends Component {
                static template = `<template><div>1</div><div>2</div></template>`;
                static $doubleVNodes = true;
            }

            render('<div><Test /></div>', {Test});
            expect(vm.$el.outerHTML).to.eql('<div><div>1</div><div>2</div></div>');
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
            render(`<Test><div :class="'a'">click</div></Test>`, {Test});
            expect(vm.$el.outerHTML).to.eql('<div class="test a">click</div>');

            (vm.$el as HTMLDivElement).click();
            expect(onClick.callCount).to.eql(1);
        });

        describe('Functional Component', () => {
            it('should not affect render Intact functional component', () => {
                class Test extends Component {
                    static template = `const C = this.C; <C />`;
                    private C = Component.functionalWrapper(() => {
                        return h('div', null, 'test');
                    });
                }
                render('<C />', {
                    C: Test 
                });

                expect(vm.$el.outerHTML).to.eql('<div>test</div>');
            });

            it('render functional component which wrap intact component', () => {
                const Test = Component.functionalWrapper(function(props: any) {
                    return h(ChildrenIntactComponent, props);
                });
                render('<C class="a" :a="1">test</C>', {
                    C: Test 
                });

                expect(vm.$el.outerHTML).be.eql('<div class="a">test</div>');
            });

            it('render functional component which return multiple vNodes', () => {
                const Test = Component.functionalWrapper(function(props: any) {
                    return [
                        h(ChildrenIntactComponent, props),
                        h(ChildrenIntactComponent, null, 'two')
                    ];
                });
                render('<div><C class="a" :a="1" ref="a" key="a">test</C></div>', {
                    C: Test 
                });

                expect((vm.$refs.a as Vue).$el.innerHTML).to.eql('test');
                expect(vm.$el.outerHTML).be.eql('<div><div class="a">test</div><div>two</div></div>');
            });

            it('render blocks in functional component', () => {
                const Test = Component.functionalWrapper((props: any) => {
                    return h(createIntactComponent(`<div><b:test /></div>`), props);
                });
                render('<C ref="test"><template slot="test"><span>test</span></template></C>', {
                    C: Test 
                }, {test: 1});

                expect(vm.$el.outerHTML).be.eql('<div><span>test</span></div>');
            });

            it('render functional components as Intact component\'s children', () => {
                const Test = Component.functionalWrapper((props: any)=> {
                    return h(SimpleIntactComponent);
                });
                render('<C><Test /></C>', {
                    C: ChildrenIntactComponent,
                    Test,
                });

                expect(vm.$el.outerHTML).to.eql('<div><div>Intact Component</div></div>');
            });
        });

        describe('Portal', () => {
            class Tooltip extends Component {
                static $doubleVNodes = true;
                static template = function(this: Tooltip) {
                    return [this.get('children'), h(Portal, null, h('span', null, 'content'))]
                }
            }

            class Dialog extends Component<{id?: string}> {
                static template = function(this: Dialog) {
                    return h(Portal, { key: 'dialog' }, h('div', { className: 'k-dialog', id: this.get('id') }, this.get('children')));
                }
            }

            it('nested $doubleVNodes', async () => {
                render(`
                    <div>
                        <Tooltip v-if="show">
                            <Tooltip>
                                <Tooltip>
                                    <div>test</div>
                                </Tooltip>
                            </Tooltip>
                        </Tooltip>
                    </div>
                `, {
                    Tooltip
                }, { show: true });

                await nextTick();
                expect(vm.$el.outerHTML).to.eql('<div><div>test</div><!--portal--><!--portal--><!--portal--></div>');

                vm.show = false;
                await nextTick();
                expect(vm.$el.outerHTML).to.eql('<div><!----></div>');
                const nextSibling = vm.$el.parentElement.nextElementSibling;
                expect(nextSibling == null || nextSibling.textContent !== 'content').to.be.true;
            });

            it('portal lifecyle order', (done) => {
                class Timepiker extends Component {
                    static template = `
                        const { Tooltip } = this;
                        <Tooltip><div>Timepiker</div></Tooltip>
                    `;

                    Tooltip = Tooltip;

                    mounted() {
                        console.log('Timepiker');
                        expect(document.querySelector('#a')!.innerHTML).to.eql('<div><div>Timepiker</div><!--portal--></div><span>content</span>');
                        done();
                    }
                }
                render(`
                    <Dialog id="a">
                        <div>
                            <Timepiker />
                        </div>
                    </Dialog>
                `, { Dialog, Timepiker })
            });
        });
    });
});
