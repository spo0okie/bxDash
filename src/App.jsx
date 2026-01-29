import React  from "react";

import './App.css';
import Layout from "Components/Layout/Layout";


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
    
    return (
        <Layout />
    );
}
  
export default App;


