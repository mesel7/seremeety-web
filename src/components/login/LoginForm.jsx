import React from "react";
import Button from "../common/Button";
import "./LoginForm.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "../../utils";

const LoginForm = ({ type, value, onChange, placeholder, maxLength, btnText, onSubmit }) => {
    return (
        <div className="LoginForm">
            <FontAwesomeIcon
                icon={type === "tel" ? icons.faPhone : icons.faHashtag}
                style={{ color: "#92a8d1" }}
            />
            <input
                type={type}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                maxLength={maxLength}
            />
            <Button text={btnText} onClick={onSubmit} />
        </div>
    )
};

export default React.memo(LoginForm);