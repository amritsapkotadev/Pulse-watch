import type {
  AuthConfig,
  BodyConfig,
  ExecuteRequestPayload,
  HeaderRow,
  ParamRow,
} from "./schema";

export const initialParams: ParamRow[] = [
  { id: "param-initial-1", key: "", value: "", enabled: true },
];

export const initialHeaders: HeaderRow[] = [
  { id: "header-initial-1", key: "", value: "", enabled: true },
];

export const initialAuth: AuthConfig = { type: "none" };

export const initialBody: BodyConfig = { type: "json", content: "" };

export const initialRequest: ExecuteRequestPayload = {
  method: "GET",
  url: "https://httpbin.org/get",
  params: initialParams,
  headers: initialHeaders,
  auth: initialAuth,
  body: initialBody,
};

export function createParamRow(): ParamRow {
  return {
    id: `param-${crypto.randomUUID()}`,
    key: "",
    value: "",
    enabled: true,
  };
}

export function createHeaderRow(): HeaderRow {
  return {
    id: `header-${crypto.randomUUID()}`,
    key: "",
    value: "",
    enabled: false,
  };
}
