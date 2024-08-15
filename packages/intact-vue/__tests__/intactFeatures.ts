import {Component, provide, inject, globalMountedQueue} from '../src';
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
import {createVNode as h, ComponentFunction} from 'intact';
import Vue from 'vue';

describe('Intact Vue Legacy', () => {
    describe('Intact Features', () => {
        describe('Lifecycle', () => {
            it('lifecycle of intact in vue', async () => {
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
                render('<C :a="a" v-if="show"/>', {
                    C: Test 
                }, {a: 1, show: true});

                expect(beforeMount.callCount).be.eq(1);
                expect(mounted.callCount).be.eql(1);
                expect(globalMountedQueue.value.length).to.eql(0);

                vm.a = 2;
                await nextTick();
                expect(beforeUpdate.callCount).be.eq(1);
                expect(updated.callCount).be.eql(1);
                expect(globalMountedQueue.value.length).to.eql(0);

                vm.show = false;
                await nextTick();
                expect(beforeUnmount.callCount).be.eq(1);
                expect(unmounted.callCount).be.eql(1);
                expect(globalMountedQueue.value.length).to.eql(0);
            });

            it('lifecycle of vue in intact', async () => {
                const created = sinon.spy(() => console.log('created'));
                const mounted = sinon.spy(() => console.log('mounted'));
                const updated = sinon.spy(() => console.log('updated'));
                const destroyed = sinon.spy();
                render('<C v-if="show" ref="a"><VueComponent :a="a" ref="b" /></C>', {
                    C: ChildrenIntactComponent,
                    VueComponent: {
                        props: ['a'],
                        template: '<div>{{ a }}</div>',
                        created,
                        mounted,
                        updated,
                        destroyed,
                    }
                }, {show: true, a: 1});

                expect(vm.$refs.a.$vnode.data.queue).to.be.null;
                expect(globalMountedQueue.value.length).to.eql(0);

                vm.a = 2;
                await nextTick();
                expect(created.callCount).be.eql(1);
                expect(mounted.callCount).be.eql(1);
                expect(updated.callCount).be.eql(1);
                expect(globalMountedQueue.value.length).to.eql(0);

                vm.show = false;
                await nextTick();
                expect(destroyed.callCount).be.eql(1);
                expect(globalMountedQueue.value.length).to.eql(0);
            });

            it('lifecycle of mounted nested intact component', async () => {
                const mounted1 = sinon.spy(() => {
                    console.log(1)
                });
                const mounted2 = sinon.spy(() => {
                    console.log(2)
                });
                const mounted3 = sinon.spy(() => {
                    console.log(3);
                });
                class Test1 extends Component {
                    static template = `<div>{this.get('children')}</div>`;
                    mounted = mounted1;
                }
                class Test2 extends Component {
                    static template = `const {Test3} = this; <div><Test3 /></div>`;
                    Test3 = Test3;
                    mounted = mounted2;
                }
                class Test3 extends Component {
                    static template = `<div></div>`;
                    mounted = mounted3;
                }

                render('<div><C><div><D /></div></C></div>', {
                    C: Test1,
                    D: Test2, 
                });

                expect(mounted1.callCount).be.eql(1);
                expect(mounted2.callCount).be.eql(1);
                expect(mounted2.calledBefore(mounted1)).be.true;
                expect(mounted3.calledBefore(mounted2)).be.true;
                expect(globalMountedQueue.value.length).to.eql(0);
            });

            it('handle mountedQueue', async () => {
                const callback = sinon.spy(() => console.log('updated'));
                class Test extends Component<{a: number}> {
                    static template = '<div>test</div>';
                    init() {
                        this.on('$receive:a', () => {
                            this.forceUpdate(callback);
                        });
                    }
                }
                render('<VueComponent :a="a" />', {
                    VueComponent: {
                        props: ['a'],
                        template: '<div><C :a="a" />{{ a }}</div>',
                        components: {
                            C: Test,
                        }
                    }
                }, {a: 1});

                expect(globalMountedQueue.value.length).to.eql(0);
                
                vm.a = 2;
                await nextTick();
                expect(vm.$el.outerHTML).to.eql('<div><div>test</div>2</div>');
                expect(globalMountedQueue.value.length).to.eql(0);

                expect(callback.callCount).to.eql(2);
            });

            it('call method of Intact component to show nested Intact component', async () => {
                const updated = sinon.spy(() => console.log('updated'));
                const mounted = sinon.spy(() => console.log('mounted'));
                function Test(isShow: boolean) {
                    return new Promise<void>(resolve => {
                        class Test1 extends Component<{show: boolean}> {
                            static template = `<div v-if={this.get('show')}>{this.get('children')}</div>`;
                            static defaults() {
                                return {show: isShow}
                            }
                            show() {
                                this.set('show', true);
                            }
                            updated() {
                                updated();
                            }
                        }
                        class Test2 extends Component {
                            static template = `const Test = this.Test; <Test />`;
                            Test = Test3;
                        }
                        class Test3 extends Component {
                            static template = '<div ref="element">test</div>';
                            mounted() {
                                expect(document.body.contains(this.refs.element)).to.be.true;
                                mounted();
                                resolve();
                            }
                        }

                        render('<div><Test1 ref="a"><div><Test2 /></div><div><Test2 /></div></Test1></div>', {
                            // Test1: {
                                // template: `<div v-if="isShow"><slot /></div>`,
                                // data() {
                                    // return {isShow}
                                // },
                                // methods: {
                                    // show() {
                                        // this.isShow = true;
                                    // }
                                // }
                            // },
                            // Test2: {
                                // template: `<div>test2</div>`,
                                // mounted() {
                                    // debugger;
                                // }
                            // },
                            Test1,
                            Test2,
                        });
                    });
                }

                await Test(true);
                expect(mounted.callCount).to.eql(2);
                expect(globalMountedQueue.value.length).to.eql(0);
                // Test(false);
                // (window as any).vm = vm;
                await Promise.all([Test(false), vm.$refs.a.show()]);
                expect(updated.callCount).to.eql(1);
                expect(mounted.callCount).to.eql(4);
                expect(globalMountedQueue.value.length).to.eql(0);
            });

            it('should call mount method when we update data in vue mounted lifecycle method', async () => {
                const updated = sinon.spy(() => console.log('updated'));
                class IntactComponent extends Component {
                    static template = `<div>{this.get('value') ? this.get('children') : null}</div>`;

                    updated = updated;
                };
                const mounted = sinon.spy(() => console.log('mounted'));
                class IntactChildrenComponent extends Component {
                    static template = `<span>{this.get('children')}</span>`;

                    mounted() {
                        mounted();
                    }
                };
                const Test = {
                    template: `
                        <IntactChildrenComponent ref="b">
                            {{ value }}
                        </IntactChildrenComponent>
                    `,
                    components: {
                        IntactChildrenComponent,
                    },
                    data() {
                        return {value: 1}
                    },
                    mounted(this: any) {
                        this.value = 2;
                    }
                };
                render(`<IntactComponent :value="show" ref="a"><Test ref="c" /></IntactComponent>`, {
                    IntactComponent, Test,
                }, {show: false});

                expect(globalMountedQueue.value.length).to.eql(0);

                // (window as any).vm = vm;
                vm.show = true;
                await nextTick();
                expect(mounted.callCount).to.eql(1);
                expect(Object.isFrozen(vm.$refs.a.$mountedQueue)).to.be.true;
                expect(Object.isFrozen(vm.$refs.c.$refs.b.$mountedQueue)).to.be.true;
                expect(globalMountedQueue.value.length).to.eql(0);
                console.log(vm.$refs.c.$senior);
            });

            it('should call mounted after all components have mounted', () => {
                const mounted = sinon.spy(function(this: any) {
                    expect(this.refs.element.parentNode).to.be.exist;
                });
                class Test extends Component {
                    static template = `<div ref="element">test</div>`;
                    mounted = mounted;
                }
                render('<div><C /><C /></div>', {C: Test});

                expect(mounted.callCount).to.eql(2);
                expect(globalMountedQueue.value.length).to.eql(0);
            });

            it('update vue component nested intact component', async () => {
                const mounted = sinon.spy();
                class Card extends Component {
                    static template = `<div class="card">{this.get('children')}</div>`;

                    mounted() {
                        console.log('mounted');
                        mounted();
                    }
                }

                const Test = Vue.extend({
                    template: `<div><slot /></div>`,
                });

                const count = 32;
                render(
                    `<Card>
                        <div v-if="show"><Card>card</Card></div>
                        <Test v-for="(item, index) in range" :key="index"><Card>card in test</Card></Test>
                    </Card>`,
                    { Card, Test },
                    { show: false, range: new Array(count).fill(0) }
                );

                vm.show = true;

                await nextTick();
                expect(mounted.callCount).to.eql(count + 2);
            });
        });

        describe('vNode', () => {
            it('should get $senior of nested component', (done) => {
                const E = createIntactComponent('<i>{this.get("children")}</i>');
                class Test extends Component {
                    static template = `<span>test</span>`;
                    mounted() {
                        expect(this.$senior).be.instanceof(E);
                        expect(this.$senior!.$senior).instanceof(ChildrenIntactComponent);
                        done();
                    }
                }
                render('<C><p><E><b><D /></b></E></p></C>', {
                    C: ChildrenIntactComponent,
                    D: Test,
                    E,
                });
            });

            it('should get $senior when pass intact component as children of intact component', () => {
                const mounted = sinon.spy();
                class A extends Component {
                    static template = `<div>{this.get('children')}</div>`
                }
                class B extends Component {
                    static template = `<div>{this.get('children')}</div>`;
                    mounted() {
                        mounted();
                        expect(this.$senior).instanceof(A);
                    }
                }
                class C extends Component {
                    static template = `const A = this.A; <A>{this.get('children')}</A>`
                    A = A;
                }

                render(`<div><C><B>test</B></C></div>`, {C, B});
                render(`<div><C><div><B>test</B></div></C></div>`, {C, B});
                expect(mounted.callCount).to.eql(2);
            });

            it('should get $senior after updating', async () => {
                const C = createIntactComponent(`<div>{this.get('children')}</div>`);
                const mounted = sinon.spy();
                const updated = sinon.spy();

                class D extends Component {
                    static template = `<i>{this.get("children")}</i>`;
                    mounted() {
                        mounted();
                        expect(this.$senior).instanceof(IntactComponent);
                        expect(this.$senior!.$senior).instanceof(C);
                        expect(this.$senior!.$senior!.$senior).instanceof(IntactComponent1);
                    }
                    updated() {
                        updated();
                        expect(this.$senior).instanceof(IntactComponent);
                        expect(this.$senior!.$senior).instanceof(C);
                        expect(this.$senior!.$senior!.$senior).instanceof(IntactComponent1);
                    }
                }

                class IntactComponent extends Component {
                    static template = `const {D} = this; <D>{this.get('children')}</D>`;
                    D = D;
                    mounted() {
                        expect(this.$senior).instanceof(C);
                    }
                }

                class IntactComponent1 extends Component {
                    static template = `const {C} = this; <C>{this.get('children')}</C>`;
                    C = C;
                }

                render(`
                    <div>
                        {{count}}
                        <IntactComponent1>
                            <p>
                                {{count}}
                                <IntactComponent>test{{count}}</IntactComponent>
                            </p>
                        </IntactComponent1>
                    </div>
                `, {
                    IntactComponent1,
                    IntactComponent,
                }, {count: 1});

                vm.count = 2;
                await nextTick();
                expect(mounted.callCount).to.eql(1);
                expect(updated.callCount).to.eql(1);
            });

            it('should get $senior of inserted Component which nests in vue element in updating', (done) => {
                let count = 0;
                class Test extends Component {
                    static template = `<span>test</span>`;
                    mounted() {
                        count++;
                        expect(this.$senior).instanceof(ChildrenIntactComponent);
                        if (count === 2) {
                            done();
                        }
                    }
                }
                render('<C><div></div><div v-if="show"><D /><D /></div></C>', {
                    C: ChildrenIntactComponent,
                    D: Test,
                }, {show: false});
                vm.show = true;
            });

            it('should get $senior when mount intact component on vue component updating', (done) => {
                // let count = 0;
                class Test extends Component {
                    static template = `<span>test</span>`;
                    mounted() {
                        // console.log(this.$senior);
                        expect(this.$senior).instanceof(ChildrenIntactComponent);
                        done();
                    }
                }
                render('<C><VueComponent ref="i" /></C>', {
                    C: ChildrenIntactComponent,
                    VueComponent: Vue.extend({
                        template: `<div><Test v-if="show" /></div>`,
                        components: {Test},
                        data() {
                            return {show: false}
                        },
                        mounted() {
                            expect(this.$parent).instanceof(ChildrenIntactComponent);
                        }
                    }),
                });

                vm.$refs.i.show = true;
            });
        });

        describe('Provide & Inject', () => {
            it('should inject correctly', () => {
                class A extends Component {
                    static template = `<div>{this.get('children')}</div>`
                    init() {
                        provide('test', 1);
                    }
                }

                class B extends Component {
                    static template = `<div>{this.test}</div>`;
                    private test = inject<number>('test')
                }

                render(`<A><div><B /></div></A>`, {
                    A, B,
                });

                expect(vm.$el.outerHTML).to.eql('<div><div><div>1</div></div></div>');

                render(`<A><B /></A>`, {
                    A, B,
                });

                expect(vm.$el.outerHTML).to.eql('<div><div>1</div></div>');
            });
        });

        describe('Validate', () => {
            it('should validate props', () => {
                const error = console.error;
                const spyError = sinon.spy((...args: any[]) => {
                    error.apply(console, args);
                });
                console.error = spyError 
                class IntactComponent extends Component<{show?: any}> {
                    static template = `<div>{this.get('children')}</div>`
                    static typeDefs = {
                        show: Boolean,
                    }
                }
                class IntactComponent2 extends IntactComponent {

                }
                render(`
                    <div>
                        <IntactComponent show="1">
                            <IntactComponent2 show="1" />
                        </IntactComponent>
                    </div>
                `, {IntactComponent, IntactComponent2});

                expect(spyError.callCount).to.eql(2);

                console.error = error;
            });
        });
    });
});
