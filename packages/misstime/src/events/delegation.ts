import {isFunction, isNull} from 'intact-shared';
import {normalizeEventName} from '../utils/common';
import {LinkedEvent, IntactEventListener, IntactElement} from '../utils/types';
import {isLinkEvent, isSameLinkEvent} from './linkEvent';

interface IEventData {
    dom: Node;
}

function getDelegatedEventObject<T>(v: T): Record<string, T> {
    return {
        'ev-click': v,
        'ev-dblclick': v,
        'ev-focusin': v,
        'ev-focusout': v,
        'ev-keydown': v,
        'ev-keypress': v,
        'ev-keyup': v,
        'ev-mousedown': v,
        'ev-mousemove': v,
        'ev-mouseup': v,
        'ev-touchend': v,
        'ev-touchmove': v,
        'ev-touchstart': v,
        'ev-contextmenu': v,
    };
}

/**
 * In QianKun framework, the main App and sub App may use misstime simultaneously
 * https://github.com/ksc-fe/kpc/issues/1002
 */
const w = globalThis as any;
const attachedEventCounts = w.__misstime_attachedEventCounts__ || (w.__misstime_attachedEventCounts__ = /*#__PURE__*/ getDelegatedEventObject<number>(0));
const attachedEvents = w.__misstime_attachedEvents__ || (w.__misstime_attachedEvents__ = /*#__PURE__*/ getDelegatedEventObject<EventListener | null>(null));

export const delegatedEvents = /*#__PURE__*/ getDelegatedEventObject<boolean>(true);

function updateOrAddDelegatedEvent(name: string, dom: IntactElement) {
    let eventsObject = dom.$EV;

    if (!eventsObject) {
        eventsObject = dom.$EV = getDelegatedEventObject<IntactEventListener>(null);
    }
    if (!eventsObject[name]) {
        if (++attachedEventCounts[name] === 1) {
            attachedEvents[name] = attachEventToDocument(name);
        }
    }

    return eventsObject;
}

export function unmountDelegatedEvent(name: string, dom: IntactElement) {
    const eventsObject = dom.$EV;

    if (eventsObject && eventsObject[name]) {
        if (--attachedEventCounts[name] === 0) {
            document.removeEventListener(normalizeEventName(name), attachedEvents[name]!);
            attachedEvents[name] = null;
        }
        eventsObject[name] = null;
    }

    return eventsObject;
}

export function handleDelegatedEvent(
    name: string,
    lastEvent: IntactEventListener,
    nextEvent: IntactEventListener,
    dom: IntactElement,
) {
    if (isFunction(nextEvent)) {
        updateOrAddDelegatedEvent(name, dom)[name] = nextEvent;
    } else if (isLinkEvent(nextEvent)) {
        if (isSameLinkEvent(lastEvent, nextEvent)) {
            return;
        }
        updateOrAddDelegatedEvent(name, dom)[name] = nextEvent;
    } else {
        unmountDelegatedEvent(name, dom);
    }
}

function attachEventToDocument(name: string) {
    const attachedEvent = // name === 'ev-click' || name === 'ev-dblclick' ?
        // rootClickEvent(name) :
        rootEvent(name);

    document.addEventListener(normalizeEventName(name), attachedEvent);

    return attachedEvent;
}

// function rootClickEvent(name: string) {
    // return function(event: Event) {
        // if ((event as MouseEvent).button !== 0) {
            // event.stopPropagation();
            // return;
        // }
        // dispatchEvents(event, true, name, extendEventProperites(event));
    // }
// }

function rootEvent(name: string) {
    const isClick = name === 'ev-click' || name === 'ev-dblclick';
    return function(event: Event) {
        dispatchEvents(event, isClick, name, extendEventProperites(event));
    }
}

function extendEventProperites(event: Event) {
    const eventData: IEventData = {
        dom: document
    };

    event.stopPropagation = stopPropagation;

    Object.defineProperty(event, 'currentTarget', {
        configurable: true,
        get() {
            return eventData.dom;
        }
    });

    return eventData;
}

function stopPropagation(this: Event) {
    this.cancelBubble = true;
    if (this.stopImmediatePropagation) {
        this.stopImmediatePropagation();
    }
}

function dispatchEvents(event: Event, isClick: boolean, name: string, eventData: IEventData) {
    let dom: IntactElement = getTargetNode(event);
    let count = attachedEventCounts[name];

    do {
        if (isClick && (dom as HTMLButtonElement).disabled) {
            return;
        }

        const eventsObject = dom.$EV;

        if (eventsObject) {
            const currentEvent = eventsObject[name];

            if (currentEvent) {
                eventData.dom = dom;
                (currentEvent as any).event ? 
                    (currentEvent as LinkedEvent<any, any>).event((currentEvent as LinkedEvent<any, any>).data, event) :
                    (currentEvent as EventListener)(event);
                if (--count === 0 || event.cancelBubble) {
                    return;
                }
            }
        }
        dom = dom.parentNode as IntactElement;
    } while (!isNull(dom))
}

function getTargetNode(event: Event): Element {
    return isFunction(event.composedPath) ? 
        event.composedPath()[0] as Element :
        /* istanbul ignore next */
        event.target as Element;
}
