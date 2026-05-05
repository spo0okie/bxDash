import React, { useState, useEffect } from "react";

import './App.css';
import Layout from "Components/Layout/Layout";
import { StoreContext, createStores } from "Data/Stores/StoreProvider";


// Create the function
function AddLibrary(url) {
    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    document.body.appendChild(script);
}


function App() {
    //какая-то мишура чтобы таски подгруженные в iframe работали
    window.BX={};
    [
        "/bitrix/cache/js/s1/light_blue/kernel_main/kernel_main.js",
        '/bitrix/js/main/core/core.js',
        '/bitrix/js/main/core/core_ajax.js',
        '/bitrix/js/main/json/json2.min.js',
        '/bitrix/js/main/core/core_ls.js',
        '/bitrix/js/main/session.js',
        '/bitrix/js/main/core/core_popup.js',
        '/bitrix/js/main/core/core_date.js',
        '/bitrix/js/main/core/core_fx.js',
        '/bitrix/js/main/core/core_webrtc.js',
        '/bitrix/js/main/core/core_dd.js',
        '/bitrix/js/main/core/core_tooltip.js',
        '/bitrix/js/main/core/core_timer.js',
        '/bitrix/js/main/core/core_window.js',
        '/bitrix/js/main/utils.js',
        '/bitrix/js/main/rating_like.js',
        '/bitrix/js/main/dd.js',
        '/bitrix/js/main/core/core_autosave.js'
    ].map((url)=>AddLibrary(url));
    //конец мишуры

    // Стораджи создаются ровно один раз — useState с ленивым инициализатором
    // идемпотентен даже при двойном mount от React.StrictMode
    const [stores] = useState(() => createStores());

    // Доступ из консоли только в dev-сборке
    useEffect(() => {
        if (!import.meta.env.DEV) return;
        Object.assign(window, {
            mainStore: stores.main,
            timeStore: stores.time,
            usersStore: stores.users,
            layoutStore: stores.layout,
            periodsStore: stores.periods,
            itemsStore: stores.items,
            alertsStore: stores.alerts,
        });
        console.log('Stores exported to window: timeStore, layoutStore, periodsStore, mainStore, usersStore, itemsStore, alertsStore');
    }, [stores]);

    return (
        <StoreContext.Provider value={stores}>
            <Layout />
        </StoreContext.Provider>
    );
}

export default App;
