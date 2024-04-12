import { Component } from './';
type Callback = () => void;
type Executor = (resolve: () => void) => void;
type AllReturn = {
    then(cb: Callback): AllReturn;
}

export class FakePromise {
    static all(promises: FakePromises): AllReturn {
        if (promises.all) return promises.all;

        const callbacks: Callback[] = [];
        let resolved = false;
        let resolvedCount = 0;

        promises.then = isAllPromisesResolved;

        promises.value.forEach(promise => {
            promise.then(isAllPromisesResolved);
        });

        function callCallback() {
            let cb;
            while (cb = callbacks.shift()) {
                cb();
            }
            promises.done = true;
        }

        function isAllPromisesResolved() {
            resolvedCount++;
            if (promises.value.length === resolvedCount) {
                resolved = true;
                callCallback();
            }
        }

        return (promises.all = {
            then(cb: Callback) {
                callbacks.push(cb); 
                if (!promises.value.length || resolved) {
                    callCallback(); 
                }

                return this;
            }
        });
    }

    public resolved = false;
    private callbacks: Callback[] = [];

    constructor(executor: Executor) {
        executor(this.resolve.bind(this)); 
    }

    public then(cb: Callback) {
        this.callbacks.push(cb);
        if (this.resolved) {
            this.resolve();
        }
    }

    private resolve() {
        this.resolved = true;
        let cb;
        while (cb = this.callbacks.shift()) {
            cb();
        }
    }
}

let id = 0;
export class FakePromises {
    public value: FakePromise[] = [];
    public then: Callback | null = null;
    public done: boolean = false;
    public all: AllReturn | null = null; 
    public name?: string;
    public id = id++;
    public component: Component<any, any, any> | null = null;

    public add(promise: FakePromise) {
        /* istanbul ignore next */
        if (process.env.NODE_ENV !== 'production') {
            if (this.done) {
                console.error(
                    `The FakePromises of '${this.name}' has done and cannot add new promise. ` +
                    'Maybe it is a bug of IntactReact'
                );
            }
        }

        this.value.push(promise);
        const then = this.then;
        if (then) {
            promise.then(then);
        }
    }

    public reset() {
        this.value = [];
        this.then = null;
        this.done = false;
        this.all = null;
    }
}
