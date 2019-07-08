/* istanbul ignore next */
export function never(value?: never): never {
    throw new Exception(`Never possible value`, {value});
}

export function maybe<T>(val: T): T | undefined {
    return val;
}

class BaseException extends Error {
    kind = 'BaseException';
    constructor(public name: string, public json = {}) {
        super();
    }
}
export class Exception extends BaseException {
    kind = 'Exception';
}
export class ClientException extends BaseException {
    kind = 'ClientException';
}
