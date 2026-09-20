import { Context } from "./receptor";

/** Per-message extras supplied by the transport (see `listen.ts`). */
export interface Env {
    sender?: chrome.runtime.MessageSender;
}

export type Delimiter = '/' | '{' | '}' | '.' | '-' | ':' | '*' | '\\' 
| '(' | ')' | '?' | '+' | ',' | ';' | '!' | '@' | '&' | '=' | '[' | ']';

/** Splits `'id/rest'` into `['id', '/rest']` at the first delimiter. */
export type Ident<S extends string, Acc extends string = ''> = S extends `${infer C}${infer R}`
? C extends Delimiter
    ? [Acc, S]
    : Ident<R, `${Acc}${C}`>
: [Acc, ''];

/** Every name introduced by `Sep` in `P`: `Names<'/a/:x/:y', ':'>` -> `'x' | 'y'`. */
export type Names<P extends string, Sep extends ':' | '*'> = P extends `${string}${Sep}${infer Rest}`
? Ident<Rest> extends [infer Name extends string, infer Tail extends string]
    ? Name | Names<Tail, Sep>
    : never
: never;

/** `P` without its optional `{...}` groups. */
export type RequiredPart<P extends string> = P extends `${infer Before}{${string}}${infer After}`
? RequiredPart<`${Before}${After}`>
: P;

/** The contents of each optional `{...}` group in `P`. */
export type OptionalGroups<P extends string> = P extends `${string}{${infer Inside}}${infer After}`
? Inside | OptionalGroups<After>
: never;

/** `:name` -> `string`, `*name` -> `string[]`, anything inside `{...}` is optional. */
export type Params<P extends string> = { [K in Names<RequiredPart<P>, ':'>]: string } & {
    [K in Names<RequiredPart<P>, '*'>]: string[];
} & { [K in Names<OptionalGroups<P>, ':'>]?: string } & { [K in Names<OptionalGroups<P>, '*'>]?: string[] };

/** What path-to-regexp hands back: values are already URI-decoded. */
export type RawParams = Partial<Record<string, string | string[]>>;

export type Next = () => Promise<Response>;

export type Handler<P extends string = string> = (c: Context<P>, next: Next) => Response | Promise<Response>;

export type ErrorHandler = (err: unknown, c: Context) => Response | Promise<Response>;

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type Matcher = (path: string) => false | { params: RawParams };

export interface Layer {
    method: Method | 'ALL';
    /** path-to-regexp pattern. `''` matches every path (middleware registered without one). */
    pattern: string;
    /** `true` for routes (whole path must match), `false` for middleware (path prefix). */
    end: boolean;
    matcher: Matcher;
    handler: Handler;
}