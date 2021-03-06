import enUS from "date-fns/locale/en-US";
import { onDemand } from "@skylib/functions";
import { reactiveStorage } from "@skylib/facades";
export const formatStrings = [
    "yyyy-M-d h:m:s a",
    "yyyy-M-d H:m:s",
    "yyyy-M-d h:m a",
    "yyyy-M-d H:m",
    "yyyy-M-d"
];
export const moduleConfig = onDemand(() => reactiveStorage({
    firstDayOfWeek: 0,
    locale: enUS,
    pm: true
}));
//# sourceMappingURL=index.js.map