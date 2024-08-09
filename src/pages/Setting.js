import PageHeader from "../components/common/PageHeader";
import SettingContent from "../components/setting/SettingContent";

const Setting = () => {
    return (
        <div className="Setting">
            <PageHeader page={"setting"} />
            <SettingContent />
        </div>
    );
};

export default Setting;