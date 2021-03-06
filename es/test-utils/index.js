import { compare, database, datetime, facebook, faker, google, handlePromise, httpRequest, inlineSearch, lang, progressReporter, reactiveStorage, showAlert, showConfirm, testDelay, uniqueId } from "@skylib/facades";
import { defineFn, typedef } from "@skylib/functions";
import enUS from "date-fns/locale/en-US";
import { implementations } from "..";
import { matchers } from "./expect";
export const jestReset = defineFn(
/**
 * Jest reset.
 */
() => {
    const { naturalCompareWrapper } = implementations.compare;
    const { PouchWrapper } = implementations.database;
    const { dateFnsWrapper } = implementations.datetime;
    const { Facebook } = implementations.facebook;
    const { loremIpsumWrapper } = implementations.faker;
    const { Google } = implementations.google;
    const { promiseHandler } = implementations.handlePromise;
    const { axiosWrapper } = implementations.httpRequest;
    const { lunrWrapper } = implementations.inlineSearch;
    const { progressBar } = implementations.progressReporter;
    const { reflectStorage } = implementations.reactiveStorage;
    const { jsAlert } = implementations.showAlert;
    const { jsConfirm } = implementations.showConfirm;
    const { configurableTestDelay } = implementations.testDelay;
    const { uuidWrapper } = implementations.uniqueId;
    {
        compare.setImplementation(naturalCompareWrapper);
        database.setImplementation(new PouchWrapper());
        datetime.setImplementation(dateFnsWrapper);
        facebook.setImplementation(new Facebook(undefined, "10.0"));
        faker.setImplementation(loremIpsumWrapper);
        google.setImplementation(new Google(undefined));
        handlePromise.setImplementation(promiseHandler);
        httpRequest.setImplementation(axiosWrapper);
        inlineSearch.setImplementation(lunrWrapper);
        progressReporter.setImplementation(progressBar);
        reactiveStorage.setImplementation(reflectStorage);
        showAlert.setImplementation(jsAlert);
        showConfirm.setImplementation(jsConfirm);
        testDelay.setImplementation(configurableTestDelay);
        uniqueId.setImplementation(uuidWrapper);
    }
    {
        progressReporter.reset();
    }
    {
        dateFnsWrapper.configure(typedef({
            firstDayOfWeek: 0,
            locale: enUS,
            pm: true
        }));
        loremIpsumWrapper.configure(typedef({
            maxSentences: 2,
            maxWords: 3,
            minSentences: 2,
            minWords: 3
        }));
        promiseHandler.configure(typedef({
            expectedDurations: {
                createDb: 1000,
                dbRequest: 1000,
                destroyDb: 1000,
                httpRequest: 1000,
                navigation: 1000
            }
        }));
        axiosWrapper.configure(typedef({
            timeout: 1000
        }));
        progressBar.configure(typedef({
            activeClass: "progress-bar-active",
            enabled: true,
            finalEasing: false,
            finalEasingSpeed: 500,
            latency: 0,
            precision: 3,
            selector: "#progressBar",
            updateInterval: 100
        }));
        configurableTestDelay.configure(typedef({
            enabled: false,
            timeout: 1000
        }));
    }
}, {
    /**
     * Jest reset.
     *
     * @param localeName - Locale name.
     * @param definitions - Language definitions.
     */
    dictionary: (localeName, definitions) => {
        const { dictionary } = implementations.lang;
        lang.setImplementation(dictionary.Dictionary.create(definitions));
        dictionary.configure(typedef({ localeName }));
    }
});
export const jestSetup = defineFn(
/**
 * Jest setup.
 */
() => {
    expect.extend(matchers);
    jestReset();
}, {
    /**
     * Jest setup.
     *
     * @param localeName - Locale name.
     * @param definitions - Language definitions.
     */
    dictionary: (localeName, definitions) => {
        jestReset.dictionary(localeName, definitions);
    }
});
//# sourceMappingURL=index.js.map