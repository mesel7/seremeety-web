import { useNavigate } from "react-router-dom";
import "./ProfileCardItem.css";
import { useState } from "react";
import ImageLoading from "../common/ImageLoading";

const ProfileCardItem = ({ uid, profilePictureUrl, nickname, age, gender }) => {
    const [isImgLoaded, setIsImgLoaded] = useState(false);
    const navigate = useNavigate();
    const handleProfileCardClick = () => {
        navigate(`/profile/${uid}`);
    };

    return (
        <div className="ProfileCardItem" onClick={handleProfileCardClick}>
            <div className="img_section">
                {!isImgLoaded && <ImageLoading />}
                <img
                    alt="PROFILE"
                    src={profilePictureUrl}
                    onLoad={() => setIsImgLoaded(true)}
                    style={{ display: !isImgLoaded ? "none" : "block" }}
                />
            </div>
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