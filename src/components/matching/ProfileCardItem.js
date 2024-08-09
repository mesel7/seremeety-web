import "./ProfileCardItem.css";

const ProfileCardItem = ({ profilePictureUrl, nickname, age, gender }) => {
    return (
        <div className="ProfileCardItem">
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