import "./Button.css";

const Button = ({ text, type, onClick }) => {
    return (
        <button className={["Button", `Button_${type}`].join(" ")} onClick={onClick}>{text}</button>
    );
};

export default Button;