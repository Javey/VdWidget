import {Component, mountedQueueStack} from '../src';
import {
    dispatchEvent,
    createIntactComponent,
    SimpleIntactComponent,
    ChildrenIntactComponent,
    PropsIntactComponent,
    WrapperComponent,
    vm,
    render,
    reset,
    nextTick,
} from './helpers';
import {createVNode as h, ComponentFunction, VNodeComponentClass, VNode} from 'intact';
import {h as v, ComponentPublicInstance, defineComponent} from 'vue';
import Normalize from './normalize.vue';
import { Portal } from './portal';

describe('Intact Vue Next', () => {
    describe('Update', () => {
        it('insert removed element should keep the original order', async () => {
            render('<div><C v-if="show">1</C><C>2</C></div>', {
                C: ChildrenIntactComponent
            }, {show: false});

            vm.show = true;

            await nextTick();
            expect(vm.$el.outerHTML).be.eql('<div><div>1</div><div>2</div></div>');
        });

        it('insert keyed child before non-keyed child', async () => {
            render('<div><div v-if="show"><C>1</C></div><div v-else><C key="1">2</C><D /></div></div>', {
                C: ChildrenIntactComponent,
                D: SimpleIntactComponent
            }, {show: true});

            vm.show = false;

            await nextTick();
            expect(vm.$el.outerHTML).be.eql('<div><div><div>2</div><div>Intact Component</div></div></div>');
        });

        it('insert keyed vue element before non-keyed element in Intact component', async () => {
            class IntactComponent extends Component {
                static template = `const C = this.C; <div>{this.get('children')}<C ref="c" /></div>`;
                private C = SimpleIntactComponent;
            }
            render(`
                <C ref="c">
                    <div key="test" v-if="show">test2</div>
                </C>
            `, {
                C: IntactComponent,
            }, {show: false});

            vm.$refs.c.refs.c.test = true;
            vm.show = true;

            await nextTick();
            expect(vm.$refs.c.refs.c.test).to.be.true;
        });

        it('insert keyed intact component that returns vue element directly', async () => {
            render(`
                <C ref="c">
                    <D key="a" v-if="show"><span>test1</span></D>
                    <D key="b"><span>test2</span></D>
                </C>
            `, {
                C: ChildrenIntactComponent,
                D: WrapperComponent,
            }, {show: false});

            vm.show = true;

            await nextTick();
            expect(vm.$el.outerHTML).to.eql('<div><span>test1</span><span>test2</span></div>')
        });

        it('update keyed functional component children', async () => {
            // v-if / v-else will add different key by Vue
            render(`
                <C>
                    <div>
                        <C :forwardRef="i => a = i" v-if="show">1</C>
                        <C :forwardRef="i => b = i" v-else>2</C>
                    </div>
                </C>
                `, {
                C: Component.functionalWrapper(function Wrapper(props: any) {
                    return h(ChildrenIntactComponent, props);
                }),
            }, {show: true});

            await nextTick();
            const a = vm.a;
            vm.show = false;
            await nextTick();
            const b = vm.b;
            expect(a === b).be.false;
            expect(vm.$el.innerHTML).be.eql('<div><div>2</div></div>');
        });

        it('diff IntactComponent with vue element', async () => {
            const C = ChildrenIntactComponent;
            render(function(this: ComponentPublicInstance<{show: boolean}>) {
                return v(C, null, this.show ? v(C, null, '1') : v('p', null, '2'));
            }, undefined, function() {
                return {
                    show: false
                }
            });

            vm.show = true;
            await nextTick();
            expect(vm.$el.outerHTML).be.eql('<div><div>1</div></div>');

            vm.show = false;
            await nextTick();
            expect(vm.$el.outerHTML).be.eql('<div><p>2</p></div>');
        });

        it('should update ref', async () => {
            const C = ChildrenIntactComponent;
            render(function(this: ComponentPublicInstance<{show: boolean}>) {
                return v('div', null, this.show ? v(C, null, 1) : v(C, {ref: 'a'}, 2));
            }, undefined, {show: true});

            vm.show = false;
            await nextTick();
            expect(vm.$refs.a.forceUpdate).to.exist;
        });

        it('should update ref in for', async () => {
            render(`
                <div>
                    <C v-for="(item, index) in data"
                        :key="index"
                        ref="test"
                        :index="item.value"
                    >{{ item.value }}</C>
                </div>
            `, {
                C: ChildrenIntactComponent
            }, {data: []}, {add(this: any, index: number) {
                this.data.push({value: this.data.length + 1});
            }});

            vm.data.push({value: 1});
            await nextTick();
            vm.data.push({value: 2});
            await nextTick();
            vm.data.push({value: 3});
            await nextTick();
            [0, 1, 2].forEach((index) => {
                expect(vm.$refs.test[index].get('index')).to.eql(index + 1);
            });
        });

        it('should watch vue component nested into intact component', async () => {
            const handler = sinon.spy();
            render('<C><D :a="a" /><div @click="add" ref="add">click</div></C>', {
                C: ChildrenIntactComponent,
                // C: {template: '<div><slot></slot></div>'},
                D: {
                    template: '<div>{{ a.join(",") }}</div>',
                    props: {
                        a: {
                            default: [],
                            type: Array,
                        }
                    },
                    watch: {
                        a: {
                            immediate: true,
                            deep: true,
                            handler,
                        }
                    }
                }
            }, {a: [2]}, {add(this: any) { this.a.push(2) }});

            await nextTick();
            expect(handler.callCount).to.eql(1);
            vm.$refs.add.click();
            await nextTick();
            expect(handler.callCount).to.eql(2);
            expect(vm.$el.innerHTML).to.eql('<div>2,2</div><div>click</div>');
        });

        it('should update correctly even if intact has changed type of element', async () => {
            class C extends Component<{total: number}> {
                static template = `if (!this.get('total')) return; <div>component</div>`;
            }
            render(function(this: ComponentPublicInstance<{show: boolean, total: number}>) {
                return v('div', null, this.show ?
                    v('div', null, v(C, {total: this.total})) :
                    v('div')
                );
            }, undefined, {show: true, total: 0});

            vm.total = 1;
            await nextTick();
            expect(vm.$el.outerHTML).eql('<div><div><div>component</div></div></div>');
            vm.show = false;
            await nextTick();
            expect(vm.$el.outerHTML).eql('<div><div></div></div>');
        });

        it('update vue element which has been reused across multiple renders', async () => {
            render(`<C ref="c"><div>test</div></C>`, {
                C: createIntactComponent(`<div>{this.get('children')}{this.get('children')}</div>`)
            });
            vm.$forceUpdate();
            await nextTick();
            expect(vm.$el.outerHTML).eql('<div><div>test</div><div>test</div></div>');

            vm.$refs.c.forceUpdate();
            await nextTick();
            expect(vm.$el.outerHTML).eql('<div><div>test</div><div>test</div></div>');
        });

        it('call intact show method to create elements that contains vue component, should get the $parent in vue component', (done) => {
            const C = createIntactComponent(`<div>{this.get('show') ? this.get('children') : undefined}</div>`);
            render(`<C ref="c"><V /></C>`, {
                C, 
                V: {
                    template: `<div>test</div>`,
                    beforeCreate() {
                        expect(this.$parent.$parent === vm).to.be.true;
                        done();
                    }
                }
            });

            vm.$refs.c.set('show', true);
        });

        it('should update vNode.el of Vue if Intact component updated and return the different dom', async () => {
            class Test extends Component<{show: boolean}, {hide: []}> {
                static template = `
                    const show = this.get('show');
                    if (!show) return;
                    <div>show</div>
                `;

                static defaults() {
                    return {show: true}
                }

                hide() {
                    this.set('show', false);
                    this.trigger('hide');
                }
            }

            render(`<div><C v-if="show" ref="c" @hide="hide" /></div>`, {C: Test}, {show: true}, {
                hide(this: any) {
                    this.show = false;
                }
            });

            vm.$refs.c.hide();

            await nextTick();
            expect(vm.$el.innerHTML).to.eql('<!--v-if-->');
        });

        it('call update method on init in Intact component', async () => {
            class Test extends Component {
                static template = `<div>test</div>`;
                init() {
                    this.forceUpdate();
                }
            }
            render('<C />', { C: Test });

            await nextTick();
            expect(vm.$el.outerHTML).to.eql('<div>test</div>');
        });

        it('should call update method of vue to update Intact functional component children that created by createVNode', async () => {
            const consoleWarn = console.warn;
            const warn = console.warn = sinon.spy(consoleWarn);
            const C = Component.functionalWrapper(function(props: any) {
                return h(WrapperComponent, props);
            });
            const D = createIntactComponent(`const children = this.get('children'); <div>{children}{children}</div>`);
            render(function(ctx: any) {
                return v(D, null, {
                    default() {
                        return v(C, null, {
                            default() {
                                return ctx.test;
                            }
                        });
                    }
                });
            }, undefined, {test: 1});

            expect(vm.$el.outerHTML).to.eql('<div>11</div>');

            vm.test = 2;
            await nextTick();
            expect(vm.$el.outerHTML).to.eql('<div>22</div>');
            expect(warn.callCount).to.eql(0);
            console.warn = consoleWarn;
        });

        it('should update children which are Intact components of Intact component', async () => {
            render(`<C><D v-if="show" /><D /></C>`, {
                C: ChildrenIntactComponent,
                D: SimpleIntactComponent,
            }, {show: false});

            vm.show = true;
            await nextTick();
            expect(vm.$el.outerHTML).to.eql('<div><div>Intact Component</div><div>Intact Component</div></div>');

            vm.show = false;
            await nextTick();
            expect(vm.$el.outerHTML).to.eql('<div><div>Intact Component</div></div>');
        });

        it('should update children which are Intact functional components of Intact component', async () => {
            render(`<C><D v-if="show" /><D /></C>`, {
                C: ChildrenIntactComponent,
                D: Component.functionalWrapper(() => {
                    return h(SimpleIntactComponent);
                }),
            }, {show: false});

            vm.show = true;
            await nextTick();
            expect(vm.$el.outerHTML).to.eql('<div><div>Intact Component</div><div>Intact Component</div></div>');

            vm.show = false;
            await nextTick();
            expect(vm.$el.outerHTML).to.eql('<div><div>Intact Component</div></div>');
        });

        it('update component in intact and the children are intact functional component', async () => {
            class Test extends Component<{show?: boolean}> {
                static template = `<div ev-click={this.onClick}>click{this.getChildren()}</div>`;
                static defaults() {
                    return { show: true };
                }

                init() {
                    this.getChildren = this.getChildren.bind(this);
                    this.onClick = this.onClick.bind(this);
                }

                onClick() {
                    this.set('show', !this.get('show'));
                }
                
                getChildren() {
                    const { children, show } = this.get();
                    if (show) {
                        return children;
                    }
                    return (children as VNode[])[1];
                }
            }

            class Tooltip extends Component {
                static template = function(this: Tooltip) {
                    return [h('div', null, 'trigger'), h(Portal, { children: this.get('children') })]
                }
            }

            render(`<ChildrenIntactComponent><Test ref="test"><D /><D /></Test></ChildrenIntactComponent>`, {
                Test,
                D: Component.functionalWrapper(() => {
                    return h(Tooltip, null, h(SimpleIntactComponent));
                }),
                ChildrenIntactComponent,
            });

            await nextTick();

            vm.$refs.test.onClick();
            await nextTick();
            expect(vm.$el.outerHTML).to.eql('<div><div>click<div>trigger</div><!--portal--></div></div>');

            vm.$refs.test.onClick();
            await nextTick();
            expect(vm.$el.outerHTML).to.eql('<div><div>click<div>trigger</div><!--portal--><div>trigger</div><!--portal--></div></div>');

            vm.$refs.test.onClick();
            await nextTick();
            expect(vm.$el.outerHTML).to.eql('<div><div>click<div>trigger</div><!--portal--></div></div>');
        });


        it('should update children of Intact component which nested in vue element', async () => {
            render(`<div><C><div v-if="show">test</div></C></div>`, {
                C: ChildrenIntactComponent,
            }, {show: false});

            vm.show = true;
            await nextTick();
            expect(vm.$el.outerHTML).to.eql('<div><div><div>test</div></div></div>');

            vm.show = false;
            await nextTick();
            expect(vm.$el.outerHTML).to.eql('<div><div></div></div>');
        });

        it('should update children of slot in Intact component which nested in vue element', async () => {
            render(`<C><template v-slot:test>{{ show }}</template></C>`, {
                C: createIntactComponent(`<div><b:test /></div>`),
            }, {show: false});

            vm.show = true;
            await nextTick();
            expect(vm.$el.outerHTML).to.eql('<div>true</div>');
        });

        it('should handle ref correctly on update block in Intact component', async () => {
            render('<C ref="c"><template v-slot:content><D ref="d" v-if="show" /></template></C>', {
                C: createIntactComponent(`<div><b:content /></div>`),
                D: SimpleIntactComponent,
            }, {show: true});

            await nextTick();
            expect(vm.$refs.c.forceUpdate).to.be.exist;
            expect(vm.$refs.d.forceUpdate).to.be.exist;

            vm.$refs.c.forceUpdate();
            await nextTick();
            expect(vm.$refs.c.forceUpdate).to.be.exist;
            expect(vm.$refs.d.forceUpdate).to.be.exist;

            vm.show = false;
            await nextTick();
            expect(vm.$refs.c.forceUpdate).to.be.exist;
            expect(vm.$refs.d).to.be.null;
        });

        it('update template with v-if', async () => {
            render('<C><template v-if="show"><C>a</C><div>placeholder</div></template><template v-if="!show"><C>1</C><C>2</C></template></C>', {
                C: ChildrenIntactComponent,
            }, { show: false});

            vm.show = true;
            await nextTick();

            vm.show = false;
            await nextTick();
            expect(vm.$el.outerHTML).to.eql('<div><div>1</div><div>2</div></div>');
        });

        it('should call mountedQueue correctly when update a component multiple times on one update phase', async () => {
            render(`<App />`, {
                App: {
                    data() {
                        return {a: 1};
                    },
                    mounted() {
                        this.a = 3;
                    },
                    template: `<Foo v-model="a" />`,
                    components: {
                        Foo: {
                            props: {
                                modelValue: Number,
                            },
                            template: `<C><Bar :modelValue="modelValue" @update:modelValue="v => $emit('update:modelValue', v)" /></C>`,
                            components: {
                                C: ChildrenIntactComponent, 
                                Bar: {
                                    props: {
                                        modelValue: Number,
                                    },
                                    watch: {
                                        modelValue: {
                                            immediate: true,
                                            handler(v) {
                                                this.$emit('update:modelValue', 2);
                                            },
                                        },
                                    },
                                    template: `<div>{{ modelValue }}</div>`
                                }
                            }
                        }
                    }
                }
            });

            await nextTick();
            expect(mountedQueueStack.size).to.eql(0);
        });

        it('should call mountedQueue correctly when update a component to create a new component, then update them again', async () => {
            const update = sinon.spy(function(children: Component) {
                expect(children.$mounted).to.be.true;
            });
            const beforeUpdate = sinon.spy(function(children: Component) {
                console.log(children.$mounted);
                expect(children.$mounted).to.be.true;
            });
            class Test extends Component {
                static template = `<div>{this.get('children')}</div>`;

                beforeUpdate() {
                    beforeUpdate(this);
                }

                updated() {
                    update(this);
                }
            }
            render(`<App />`, {
                App: {
                    data() {
                        return {a: 1};
                    },
                    mounted() {
                        this.a = 3;
                    },
                    template: `<Foo v-model="a" />`,
                    components: {
                        Foo: {
                            props: {
                                modelValue: Number,
                            },
                            template: `
                                <Test><Bar :modelValue="modelValue" @update:modelValue="v => $emit('update:modelValue', v)" /></Test>
                                <Test v-if="modelValue === 2 || modelValue === 4">
                                    <Bar :modelValue="modelValue" @update:modelValue="v => $emit('update:modelValue', v)" />
                                </Test>
                            `,
                            components: {
                                Test, 
                                Bar: {
                                    props: {
                                        modelValue: Number,
                                    },
                                    watch: {
                                        modelValue: {
                                            immediate: true,
                                            handler(v) {
                                                if (v === 2 || v === 4) {
                                                    this.$emit('update:modelValue', 4);
                                                } else {
                                                    this.$emit('update:modelValue', 2);
                                                }
                                            },
                                        },
                                    },
                                    template: `<div>{{ modelValue }}</div>`
                                }
                            },
                        }
                    }
                }
            });

            await nextTick();
            expect(mountedQueueStack.size).to.eql(0);
        });

        it('should track update if we render new component in Intact', async () => {
            class Test extends Component {
                static template = `
                    const {show, data} = this.get();
                    <div>
                        <div ev-click={() => this.set('show', !show)}>click</div>
                        <div v-if={show}>{data.a}</div>
                    </div>`
                static defaults() {
                    return {show: false}
                }
            } 

            render(`<Test :data="data" ref="test" />`, {
                Test
            }, {
                data: {
                    a: 1
                }
            });

            vm.$refs.test.set('show', true);
            await nextTick();

            vm.data.a = 2;
            await nextTick();

            expect(vm.$el.textContent).to.eql('click2');

            vm.$refs.test.set('show', false);
            await nextTick();
            vm.data.a = 3;
            await nextTick();
            vm.$refs.test.set('show', true);
            await nextTick();
            expect(vm.$el.textContent).to.eql('click3');
        });

        describe('Multiple vNodes Component', () => {
            class Test extends Component {
                static $doubleVNodes = true;
                static template = `<template><div>1</div><div>2</div></template>`;
            }

            it('remove component', async () => {
                render('<div><Test v-if="show" /></div>', {Test }, {show: true});

                vm.show = false;
                await nextTick();
                expect(vm.$el.innerHTML).to.eql('<!--v-if-->');

                vm.show = true;
                await nextTick();
                expect(vm.$el.innerHTML).to.eql('<div>1</div><div>2</div>');
            });
        });
    });
});
