/* Global type declarations for Google Analytics 4 (gtag.js) */

interface GtagEventParams {
  event_category?: string;
  event_label?: string;
  page_path?: string;
  page_title?: string;
  value?: number;
  [key: string]: string | number | boolean | undefined;
}

interface Window {
  gtag: (
    command: "config" | "event" | "js" | "set",
    targetOrEvent: string | Date,
    params?: GtagEventParams | Record<string, unknown>,
  ) => void;
  dataLayer: Array<unknown>;
}
