import React from "react";
import "./LoginLogo.css";
import seremeetyLogo from "../../images/img_seremeety_logo.png";

const LoginLogo = () => {
    return (
        <div className="LoginLogo">
            <img alt="SEREMEETY" src={seremeetyLogo} />
            <div className="logo_text">Seremeety</div>
        </div>
    );
};

export default React.memo(LoginLogo);