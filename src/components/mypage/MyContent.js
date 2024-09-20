import "./MyContent.css";
import MyProfilePreview from "./MyProfilePreview";
import SelfIntroduction from "./SelfIntroduction";

const MyContent = ({ userProfile, style }) => {
    return (
        <div className="MyContent" style={style}>
            <MyProfilePreview userProfile={userProfile} />
            <SelfIntroduction userProfile={userProfile} />
        </div>
    );
};

export default MyContent;