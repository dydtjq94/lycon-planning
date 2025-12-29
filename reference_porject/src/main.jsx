import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./libs/mixpanel"; // Mixpanel 초기화

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
