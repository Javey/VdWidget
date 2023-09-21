import {render, createVNode as h} from 'misstime';
import {TransitionGroup} from '../src/components/transitionGroup';
import {wait, testTransition, nextTick} from '../../misstime/__tests__/utils';
import './transition.css';
import {Component} from '../src/core/component';

describe('Component', function() {
    this.timeout(0);

    let container: Element;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    describe('TransitionGroup', () => {
        it('should appear with transition', async () => {
            render(h(TransitionGroup, {appear: true}, [
                h('div', {key: '1'}, '1'),
                h('div', {key: '2'}, '2'),
            ]), container);

            await Promise.all([
                testTransition(container.children[0]!, 'enter'),
                testTransition(container.children[1]!, 'enter'),
            ]);
        });

        it('should enter with transition', async () => {
            render(h(TransitionGroup), container);
            render(h(TransitionGroup, null, [
                h('div', {key: '1'}, '1'),
                h('div', {key: '2'}, '2'),
            ]), container);

            await Promise.all([
                testTransition(container.children[0]!, 'enter'),
                testTransition(container.children[1]!, 'enter'),
            ]);
        });

        it('should enter with transition with initial child', async () => {
            render(h(TransitionGroup, null, [
                h('div', {key: '1'}, '1'),
            ]), container);
            render(h(TransitionGroup, null, [
                h('div', {key: '1'}, '1'),
                h('div', {key: '2'}, '2'),
            ]), container);

            await Promise.all([
                testTransition(container.children[1]!, 'enter'),
            ]);
        });

        it('should leave with transition', async () => {
            render(h(TransitionGroup, null, [
                h('div', {key: '1'}, '1'),
                h('div', {key: '2'}, '2'),
            ]), container);
            render(h(TransitionGroup), container);

            await Promise.all([
                testTransition(container.children[0]!, 'leave'),
                testTransition(container.children[1]!, 'leave'),
            ]);

            expect(container.innerHTML).to.equal('');
        });

        it('should move with transition', async () => {
            render(h(TransitionGroup, null, [
                h('div', {key: '1'}, '1'),
                h('div', {key: '2'}, '2'),
            ]), container);
            render(h(TransitionGroup, null, [
                h('div', {key: '2'}, '2'),
                h('div', {key: '1'}, '1'),
            ]), container);

            await Promise.all([
                testMoveTransition(container.children[0]!),
                testMoveTransition(container.children[1]!),
            ]);
        });

        it('should move component', async () => {
            class Test extends Component {
                static template(this: Test) {
                    return h('div', null, this.$props.children);
                }
            }

            render(h(TransitionGroup, null, [
                h(Test, {key: '1'}, '1'),
                h(Test, {key: '2'}, '2'),
            ]), container);
            render(h(TransitionGroup, null, [
                h(Test, {key: '2'}, '2'),
                h(Test, {key: '1'}, '1'),
            ]), container);

            await Promise.all([
                testMoveTransition(container.children[0]!),
                testMoveTransition(container.children[1]!),
            ]);
        });

        it('should move an enter element correctly', async () => {
            render(h(TransitionGroup, null, [
                h('div', {key: '1'}, '1'),
            ]), container);
            render(h(TransitionGroup, null, [
                h('div', {key: '1'}, '1'),
                h('div', {key: '2'}, '2'),
            ]), container);
            render(h(TransitionGroup, null, [
                h('div', {key: '2'}, '2'),
                h('div', {key: '1'}, '1'),
            ]), container);

            // await Promise.all([

            // ]);
        });

        it('should enter a element which is leaving', async () => {
            render(h(TransitionGroup, null, [
                h('div', {key: '1'}, '1'),
                h('div', {key: '2'}, '2'),
            ]), container);
            await wait(0);
            render(h(TransitionGroup, null, [
                h('div', {key: '1'}, '1'),
            ]), container);
            await wait(0);
            render(h(TransitionGroup, null, [
                h('div', {key: '1'}, '1'),
                h('div', {key: '2'}, '2'),
                h('div', {key: '3'}, '3'),
            ]), container);

            expect(container.childElementCount).to.eql(3);
            await Promise.all([
                testTransition(container.children[1]!, 'enter'),
                testTransition(container.children[2]!, 'enter'),
            ]);
        });

        it('should cancel the right element', async () => {
            render(h(TransitionGroup, null, [
                h('div', {key: '1'}, '1'),
                h('div', {key: '2'}, '2'),
            ]), container);
            await wait(0);
            render(h(TransitionGroup, null, [
                h('div', {key: '1'}, '1'),
                h('div', {key: '3'}, '3'),
                h('div', {key: '4'}, '4'),
            ]), container);
            await wait(0);
            render(h(TransitionGroup, null, [
                h('div', {key: '1'}, '1'),
                h('div', {key: '3'}, '3'),
            ]), container);

            await testTransition(container.children[2], 'enter');
        });
    });
});

async function testMoveTransition(dom: Element) {
    expect(dom.className).to.equal(`transition-move`);

    await wait(2100);
    expect(dom.className).to.equal('');
}
