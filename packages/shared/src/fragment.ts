type FragmentWithMeta = DocumentFragment & {
    _fragementFirstChild: Node 
    _fragementLastChild: Node 
} 

export function proxyFragment(fragment: FragmentWithMeta) {
    const { firstChild, lastChild } = fragment;
    fragment._fragementFirstChild = firstChild!;
    fragment._fragementLastChild = lastChild!;

    Object.defineProperty(fragment, 'parentNode', {
        get() {
            return firstChild!.parentNode; 
        }
    });

    Object.defineProperty(fragment, 'nextSibling', {
        get() {
            return lastChild!.nextSibling;
        }
    });
}

export function proxyFragmentParent(fragment: FragmentWithMeta) {
    const parentNode = fragment.parentNode as Node & {_intactVueLegacyRewrote?: boolean};
    if (!parentNode || parentNode._intactVueLegacyRewrote) return;

    const removeChild = parentNode.removeChild;
    parentNode.removeChild = function<T extends Node>(child: T) {
        if (isFragmentDom(child)) {
            const lastChild = child._fragementLastChild;
            let sibling: Node | null = child._fragementFirstChild;
            while (sibling && sibling !== lastChild) {
                let dom = sibling;
                sibling = sibling.nextSibling;
                removeChild.call(this, dom);
            }
            return removeChild.call(this, lastChild) as T;
        }
        return removeChild.call(this, child) as T; 
    };

    const insertBefore = parentNode.insertBefore;
    parentNode.insertBefore = function<T extends Node>(newChild: T, refChild: Node | null): T {
        if (refChild && isFragmentDom(refChild)) {
            return insertBefore.call(this, newChild, refChild._fragementFirstChild) as T;
        }
        return insertBefore.call(this, newChild, refChild) as T;
    }

    parentNode._intactVueLegacyRewrote = true;
}

export function isFragmentDom(node: Node): node is FragmentWithMeta {
    return node.nodeType === 11 /* fragment */
}
