import {currentInstance, Component} from './component';
import {throwError} from 'intact-shared';
import {Props} from 'misstime';
import {LifecycleEvents, ChangeCallback} from '../utils/types';

export type WatchOptions = {
    inited?: boolean,
    presented?: boolean,
}

export function watch<P extends {}, K extends keyof Props<P, Component>> (
    key: K,
    callback: ChangeCallback<Props<P, Component>, K>,
    options?: WatchOptions,
    instance: Component<P> | null = currentInstance 
) {
    if (process.env.NODE_ENV !== 'production') {
        if (!instance) {
            throwError('watch() can only be used inside init()');
        }
    }

    if (!options || !options.presented) {
        // instance!.on(`$change:${key}` as `$change:${string & K}`, (newValue, oldValue) => {
            // const realNewValue = instance!.get(key);
            // if (realNewValue !== newValue) {
                // oldValue = newValue
                // newValue = realNewValue;
            // }
            // callback(newValue, oldValue);
        // });
        // @ts-ignore
        instance!.on(`$change:${key}` as `$change:${string & K}`, (newValue, oldValue) => {
            /**
             * maybe the newValue has been changed, see intact-react unit test: update in updating
             */
            newValue = instance!.get(key);
            callback(newValue, oldValue);
        });
        if (!options || !options.inited) {
            // @ts-ignore
            instance!.on(`$receive:${key}` as `$receive:${string & K}`, callback);
        } else {
            // @ts-ignore
            instance!.on(`$receive:${key}` as `$receive:${string & K}`, (newValue, oldValue, init) => {
                if (!init) {
                    callback(newValue, oldValue);
                }
            });
        }
    } else {
        // @ts-ignore
        instance!.on(`$changed:${key}` as `$changed:${string & K}`, (newValue, oldValue) => {
            newValue = instance!.get(key);
            callback(newValue, oldValue);
        });
        if (!options.inited) {
            // @ts-ignore
            instance!.on(`$receive:${key}` as `$receive:${string & K}`, (newValue, oldValue, init) => {
                let lifecycle: keyof LifecycleEvents<any> = init ? '$mounted' : '$updated';
                const fn = () => {
                    (instance!.off as Function)(lifecycle, fn);
                    callback(newValue, oldValue);
                };
                instance!.on(lifecycle, fn);
            });
        } else {
            // @ts-ignore
            instance!.on(`$receive:${key}` as `$receive:${string & K}`, (newValue, oldValue, init) => {
                if (!init) {
                    const fn = () => {
                        (instance!.off as Function)('$updated', fn);
                        callback(newValue, oldValue);
                    };
                    instance!.on('$updated', fn); 
                }
            });
        }
    }
}

