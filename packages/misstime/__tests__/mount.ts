import {
    createElementVNode,
    createTextVNode, 
    createComponentVNode,
    createCommentVNode,
    createFragment,
    createVNode as h,
} from '../src/core/vnode';
import {Types, ChildrenTypes, ComponentClass, Props, VNodeComponentClass, VNode} from '../src/utils/types';
import {mount} from '../src/core/mount';
import {createRef} from '../src/utils/ref';
import {render} from '../src/core/render';

describe('Mount', () => {
    let container: Element;

    beforeEach(() => {
        container = document.createElement('div');
    });

    afterEach(() => {
        render(null, container);
    });

    it('should mount vNode', () => {
        const vNode = createElementVNode(
            Types.CommonElement, 
            'div',
            createElementVNode(Types.CommonElement, 'div'),
            ChildrenTypes.UnknownChildren,
            'class-name',
            {id: 1}
        );
        render(vNode, container);
        expect(container.innerHTML).to.equal('<div class="class-name" id="1"><div></div></div>');
    });

    it('should mount text children of vNode', () => {
        const vNode = createElementVNode(
            Types.CommonElement,
            'div',
            'test',
            ChildrenTypes.UnknownChildren,
        );
        render(vNode, container);
        expect(container.innerHTML).to.equal('<div>test</div>');
    });

    it('should mount text vNode', () => {
        const vNode = createTextVNode('test');
        render(vNode, container);
        expect(container.innerHTML).to.equal('test');
    });

    it('should mount array children of vNode', () => {
        const child = createElementVNode(Types.CommonElement, 'div');
        const vNode = createElementVNode(
            Types.CommonElement,
            'div',
            [child, child],
            ChildrenTypes.UnknownChildren,
        );
        render(vNode, container);
        expect(container.innerHTML).to.equal('<div><div></div><div></div></div>');
    });

    it('should mount non-keyed children', () => {
        const child = createElementVNode(Types.CommonElement, 'div');
        const vNode = createElementVNode(
            Types.CommonElement,
            'div',
            [child, child],
            ChildrenTypes.HasNonKeyedChildren,
        );
        render(vNode, container);
        expect(container.innerHTML).to.equal('<div><div></div><div></div></div>');
    });

    it('should mount used child', () => {
        const child = createElementVNode(Types.CommonElement, 'i');
        const foo = createElementVNode(Types.CommonElement, 'div', child, ChildrenTypes.HasVNodeChildren);
        const bar = createElementVNode(Types.CommonElement, 'div', child, ChildrenTypes.HasVNodeChildren);
        const vNode = createElementVNode(
            Types.CommonElement,
            'div',
            [foo, bar],
            ChildrenTypes.HasNonKeyedChildren,
        );
        render(vNode, container);
        expect(container.innerHTML).to.equal('<div><div><i></i></div><div><i></i></div></div>')
    });

    it('should mount svg element', () => {
        const vNode = createElementVNode(
            Types.SvgElement,
            'svg',
            createElementVNode(Types.CommonElement, 'circle'),
            ChildrenTypes.HasVNodeChildren, 
            'class-name'
        );
        render(vNode, container);

        expect(container.firstChild!.namespaceURI).to.equal('http://www.w3.org/2000/svg');
        expect(container.firstChild!.firstChild!.namespaceURI).to.equal('http://www.w3.org/2000/svg');
    });

    it('should throw error if we mount invalid vNode', () => {
        expect(() => mount([] as any, container, null, false, null, [])).to.throw();
        expect(() => mount((() => {}) as any, container, null, false, null, [])).to.throw();
    });

    it('should mount ref that is RefObject', () => {
        const ref = createRef();        
        const vNode = createElementVNode(
            Types.InputElement,
            'span',
            null,
            null,
            null,
            null,
            null,
            ref
        );
        render(vNode, container);

        expect(ref.value!.outerHTML).to.equal('<span></span>');
    });

    it('should mount ref that is function', () => {
        let ref: Element | null;        
        const vNode = createElementVNode(
            Types.InputElement,
            'span',
            null,
            null,
            null,
            null,
            null,
            i => ref = i,
        );
        render(vNode, container);

        expect(ref!.outerHTML).to.equal('<span></span>');
    });

    // it('should mount component', () => {
        // const vNode = createComponentVNode(Types.ComponentClass, Component);
        // render(vNode, container);

        // expect(container.innerHTML).to.equal('<div></div>');
    // });

    // it('should call mounted method when mounted', () => {
        // const mounted = jasmine.createSpy();
        // class TestComponent extends Component {
            // mounted() {
                // mounted();
            // }
        // }
        // render(createComponentVNode(Types.ComponentClass, TestComponent), container);
        // expect(mounted).toHaveBeenCalledTimes(1);
    // });

    it('should mount comment', () => {
        const vNode = createCommentVNode('comment');
        render(vNode, container);        

        expect(container.innerHTML).to.equal('<!--comment-->');
    });

    describe('Fragment', () => {
        it('should mount Fragment that children is vNode', () => {
            render(createFragment(
                createElementVNode(Types.CommonElement, 'div'), 
                ChildrenTypes.UnknownChildren
            ), container);

            expect(container.innerHTML).to.equal('<div></div>');
        });

        it('should mount Fragment that child is text', () => {
            render(createFragment(
                'text',
                ChildrenTypes.UnknownChildren
            ), container);

            expect(container.innerHTML).to.equal('text');
        });

        it('should mount Fragment that child is invalid', () => {
            render(createFragment(
                null,
                ChildrenTypes.UnknownChildren
            ), container);

            expect(container.innerHTML).to.equal('');
        });

        it('should mount Fragment that children is vNode[]', () => {
            render(createFragment(
                [
                    createElementVNode(Types.CommonElement, 'div'),
                    null,
                    createFragment(
                        'text',
                        ChildrenTypes.HasTextChildren,
                    ),
                    createElementVNode(Types.CommonElement, 'span'),
                ],
                ChildrenTypes.UnknownChildren
            ), container);

            expect(container.innerHTML).to.equal('<div></div>text<span></span>');
        });

        it('should mount used Fragment', () => {
            const child = createFragment(h('i'), ChildrenTypes.HasVNodeChildren);
            const foo = createElementVNode(Types.CommonElement, 'div', child, ChildrenTypes.HasVNodeChildren);
            const bar = createElementVNode(Types.CommonElement, 'div', child, ChildrenTypes.HasVNodeChildren);
            const vNode = createElementVNode(
                Types.CommonElement,
                'div',
                [foo, bar],
                ChildrenTypes.HasNonKeyedChildren,
            );
            render(vNode, container);

            expect(container.innerHTML).to.equal('<div><div><i></i></div><div><i></i></div></div>')
            expect((child.children as VNode).dom).to.equal(container.firstElementChild!.firstElementChild!.firstElementChild);
        });

        it('should mount used Fragment which children is text', () => {
            const fragment = createFragment('text', ChildrenTypes.UnknownChildren);
            render(h('div', null, [
                fragment,
                fragment
            ]), container);

            expect(container.innerHTML).to.equal('<div>texttext</div>');
            expect((fragment.children as VNode[])[0].dom).to.equal(container.firstElementChild!.firstChild as Text);
        });
    });
});

