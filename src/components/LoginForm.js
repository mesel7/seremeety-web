import Button from "./Button";
import "./LoginForm.css";

const LoginForm = ({ type, value, onChange, placeholder, btnText, onSubmit }) => {
    return (
        <div className="LoginForm">
            <input
                type={type}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
            />
            <Button text={btnText} onClick={onSubmit} />
        </div>
    )
};

export default LoginForm;