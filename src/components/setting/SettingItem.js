import "./SettingItem.css";

const SettingItem = ({ content, onClick }) => {
    return (
        <div className="SettingItem" onClick={onClick}>
            {content}
        </div>
    );
};

export default SettingItem;