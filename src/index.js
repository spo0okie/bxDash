import React from 'react';
//import 'reflect-metadata';
import ReactDOM from 'react-dom/client';
//import {Provider} from "mobx-react";
//import { StoreProvider } from "./Stores/StoreProvider.js";
import reportWebVitals from './reportWebVitals';
//import usersStore from './Stores/usersStore';
import App from './App';

import './index.css';





const root = ReactDOM.createRoot(document.getElementById('root'));
//const stores = {mainStore,usersStore};






root.render(
  <React.StrictMode>
      <App />
  </React.StrictMode>
);
//
//</React.StrictMode>

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
