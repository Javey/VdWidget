import {
    Reference,
    IntactDom,
    VNode, 
    Types,
    ChildrenTypes,
    ComponentConstructor,
    ComponentFunction,
    ComponentClass,
    TransitionElement,
    Hooks,
} from './types';
import {isNull, isNullOrUndefined} from 'intact-shared';

export function normalizeEventName(name: string) {
    return name.substr(3);
}

export function replaceChild(parentDom: Element, newDom: Element, lastDom: Element) {
    parentDom.replaceChild(newDom, lastDom);
}

export function setTextContent(dom: Element, children: string) {
    dom.textContent = children;
}

export function removeChild(parentDom: Element, dom: IntactDom) {
    (parentDom as any).removeChild(dom, true);
}

export function insertOrAppend(parentDom: Element, newNode: IntactDom, anchor: IntactDom | null) {
    if (isNull(anchor)) {
        parentDom.appendChild(newNode);
    } else {
        parentDom.insertBefore(newNode, anchor);
    }
}


export const REFERENCE: Reference = {value: false};

export const Fragment: string = '$F';

export function removeVNodeDom(vNode: VNode, parentDom: Element) {
    let type: Types;
    let dom: IntactDom;
    do {
        type = vNode.type;
        if (type & Types.HtmlElement) {
            const transition = vNode.transition;
            if (isNullOrUndefined(transition)) {
                removeChild(parentDom, vNode.dom!);
            } else {
                dom = vNode.dom!;
                transition.leave(dom as TransitionElement, () => removeChild(parentDom, dom));
            }
            return;
        }

        const children = vNode.children;

        if (type & Types.ComponentClass) {
            vNode = (children as ComponentClass).$lastInput!;
        } else if (type & Types.ComponentFunction) {
            vNode = children as VNode;
        } else if (type & Types.Fragment) {
            if (vNode.childrenType === ChildrenTypes.HasVNodeChildren) {
                vNode = children as VNode;
            } else {
                for (let i = 0; i < (children as VNode[]).length; i++) {
                    removeVNodeDom((children as VNode[])[i], parentDom);
                }
                return;
            }
        }
    } while (vNode);
}

export function findDomFromVNode(vNode: VNode, startEdge: boolean) {
    let type: Types;
    
    while (vNode) {
        type = vNode.type;

        if (type & Types.HtmlElement) {
            return vNode.dom;
        }

        vNode = findChildVNode(vNode, startEdge, type);
    }

    return null;
}

function findChildVNode(vNode: VNode, startEdge: boolean, type: Types) {
    const children = vNode.children;

    if (type & Types.ComponentClass) {
        return (children as ComponentClass).$lastInput!;
    }

    if (type & Types.Fragment) {
        return vNode.childrenType === ChildrenTypes.HasVNodeChildren ?
            (children as VNode) :
            (children as VNode[])[startEdge ? 0 : (children as VNode[]).length - 1];
    }

    return children as VNode;
}

export function findDomsFromVNode(vNode: VNode) {
    while (vNode) {
        const type = vNode.type;
        if (type & Types.HtmlElement) {
            return vNode.dom;
        }

        if (type & Types.Fragment) {
            const children = vNode.children;
            if (vNode.childrenType === ChildrenTypes.HasVNodeChildren) {
                vNode = children as VNode;
                continue;
            } else {
                const fragment = document.createDocumentFragment();
                for (let i = 0; i < (children as VNode[]).length; i++) {
                    fragment.appendChild(findDomsFromVNode((children as VNode[])[i])!);
                } 

                return fragment;
            }
        }

        if (type & Types.ComponentClass) {
            vNode = (vNode.children as ComponentClass).$lastInput!;
            continue;
        }

        vNode = vNode.children as VNode;
    }
}

export function moveVNodeDom(vNode: VNode, parentDom: Element, anchor: IntactDom | null) {
    do {
        const type = vNode.type;

        if (type & Types.HtmlElement) {
            // TODO: move with transtion
            insertOrAppend(parentDom, vNode.dom!, anchor);
            return;
        }

        const children = vNode.children;

        if (type & Types.ComponentClass) {
            vNode = (children as ComponentClass).$lastInput!;
        } else if (type & Types.ComponentFunction) {
            vNode = children as VNode;
        } else if (type & Types.Fragment) {
            if (vNode.childrenType === ChildrenTypes.HasVNodeChildren) {
                vNode = children as VNode;
            } else {
                for (let i = 0; i < (children as VNode[]).length; i++) {
                    moveVNodeDom((children as VNode[])[i], parentDom, anchor);
                }
                return;
            }
        }
    } while (vNode);
}

export function getComponentName(tag: ComponentConstructor | ComponentFunction) {
    return tag.name || tag.displayName; // || tag.constructor.name || (tag.toString().match(/^function\s*([^\s(]+)/) || [])[1];
}

export function callAll(mountedQueue: Function[] & {i?: number, done?: boolean}) {
    if (process.env.NODE_ENV !== 'production') {
        if (Object.isFrozen(mountedQueue)) {
            throw new Error('Call the same mountedQueue again becasue it is frozen. Please create a issue for Intact.');
        }
    }
    // add a mountedQueue.i property, see mountRef function
    for (let i = mountedQueue.i = 0; i < mountedQueue.length; i++) {
        mountedQueue.i++;
        mountedQueue[i]();
    }
    mountedQueue.done = true;
    if (process.env.NODE_ENV !== 'production') {
        Object.freeze(mountedQueue);
    }
}

const xlinkNS = "http://www.w3.org/1999/xlink";
const xmlNS = "http://www.w3.org/XML/1998/namespace";
export const namespaces: Record<string, string> = {
    'xlink:href': xlinkNS,
    'xlink:arcrole': xlinkNS,
    'xlink:actuate': xlinkNS,
    'xlink:show': xlinkNS,
    'xlink:role': xlinkNS,
    'xlink:title': xlinkNS,
    'xlink:type': xlinkNS,
    'xml:base': xmlNS,
    'xml:lang': xmlNS,
    'xml:space': xmlNS,
};

export const hooks: Hooks = {
    beforeInsert: null, 
};
