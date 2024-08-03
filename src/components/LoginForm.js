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
            <button onClick={onSubmit}>{btnText}</button>
        </div>
    )
};

export default LoginForm;