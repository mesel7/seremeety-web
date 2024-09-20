import { settingItem } from "../../utils";
import "./SettingContent.css";
import SettingItem from "./SettingItem";

const SettingContent = ({ style }) => {
    return (
        <div className="SettingContent" style={style}>
            {settingItem.map((it, idx) => <SettingItem key={idx} {...it} />)}
        </div>
    );
};

export default SettingContent;