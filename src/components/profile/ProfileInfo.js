import "./ProfileInfo.css"

const ProfileInfo = ({ field, id, data }) => {
    if (id === "gender") {
        data = data === "male" ? "남성" : "여성";
    }
    return (
        <div className={["ProfileInfo", `ProfileInfo_${id}`].join(" ")}>
            <div className={["profile_field", `profile_field_${id}`].join(" ")}>{field}</div>
            <div className={["profile_data", `profile_data_${id}`].join(" ")}>{data}</div>
        </div>
    );
};

export default ProfileInfo;