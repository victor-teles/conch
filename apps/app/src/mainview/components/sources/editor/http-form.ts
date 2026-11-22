import type { HttpEndpointInput, RedactedHttpEndpoint } from "@/lib/ipc";

export type HttpAuthKind = "none" | "header";

export interface HttpFormState {
  name: string;
  baseUrl: string;
  authKind: HttpAuthKind;
  headerName: string;
  headerValue: string;
  storedHint: string | null;
  stored: boolean;
}

export const httpFormOf = (
  endpoint: RedactedHttpEndpoint | null
): HttpFormState => ({
  authKind: endpoint?.auth.kind ?? "header",
  baseUrl: endpoint?.baseUrl ?? "",
  headerName:
    endpoint?.auth.kind === "header" ? endpoint.auth.name : "Authorization",
  headerValue: "",
  name: endpoint?.name ?? "",
  stored: endpoint?.auth.kind === "header" && endpoint.auth.hasValue,
  storedHint: endpoint?.auth.kind === "header" ? endpoint.auth.hint : null,
});

export const httpInputOf = (
  form: HttpFormState,
  id: string | null
): HttpEndpointInput => ({
  auth:
    form.authKind === "header"
      ? {
          kind: "header",
          name: form.headerName.trim(),
          value:
            form.stored && form.headerValue === ""
              ? undefined
              : form.headerValue,
        }
      : { kind: "none" },
  baseUrl: form.baseUrl.trim(),
  name: form.name.trim(),
  ...(id ? { id } : {}),
});

export const httpFormProblem = (form: HttpFormState): string | null => {
  if (!form.name.trim()) {
    return "Give the endpoint a name.";
  }
  if (!form.baseUrl.trim()) {
    return "Enter the API's base URL.";
  }
  return null;
};
