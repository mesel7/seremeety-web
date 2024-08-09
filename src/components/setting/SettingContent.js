import { settingItem } from "../../utils";
import "./SettingContent.css";
import SettingItem from "./SettingItem";

const SettingContent = () => {
    return (
        <div className="SettingContent">
            {settingItem.map((it, idx) => <SettingItem key={idx} {...it} />)}
        </div>
    );
};

export default SettingContent;