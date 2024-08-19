import { useNavigate } from "react-router-dom";
import "./ProfileCardItem.css";

const ProfileCardItem = ({ uid, profilePictureUrl, nickname, age, gender }) => {
    const navigate = useNavigate();
    const handleProfileCardClick = () => {
        navigate(`/profile/${uid}`);
    };

    return (
        <div className="ProfileCardItem" onClick={handleProfileCardClick}>
            <img alt="PROFILE" src={profilePictureUrl} />
            <div className="content_section">
                <div className="nickname_wrapper">
                    {nickname}
                </div>
                <div className="age_gender_wrapper">
                    {`${age} ${gender === "male" ? "남" : "여"}`}
                </div>
            </div>
        </div>
    );
};

export default ProfileCardItem;