import ProfileCardItem from "../matching/ProfileCardItem";
import "./SelfIntroduction.css";

const SelfIntroduction = ({ userProfile }) => {
    return (
        <div className="SelfIntroduction">
            <h2>Self Introduction</h2>
            <div className="mock_content">
                <ProfileCardItem
                    profilePictureUrl={"https://firebasestorage.googleapis.com/v0/b/seremeety-web.appspot.com/o/profile_pictures%2FtNCgtrwvKcXIFrF8ixamo4DIUnv1?alt=media&token=1f6970e2-1ae0-4c74-8c5a-c6f2fdfc0bd4"}
                    nickname={"민쵸"}
                    age={"20세"}
                    gender={"female"}
                    place={"서울 노원구"}
                    profileStatus={userProfile.profileStatus}
                />
                <ProfileCardItem
                    profilePictureUrl={"https://firebasestorage.googleapis.com/v0/b/seremeety-web.appspot.com/o/profile_pictures%2FayoocWZ8OsSOc3wltG4kamngkBy1?alt=media&token=4c3a25e4-1277-4376-a76c-86086fb846e7"}
                    nickname={"아샷추"}
                    age={"22세"}
                    gender={"female"}
                    place={"서울 송파구"}
                    profileStatus={userProfile.profileStatus}
                />
                <ProfileCardItem
                    profilePictureUrl={"https://firebasestorage.googleapis.com/v0/b/seremeety-web.appspot.com/o/profile_pictures%2Fbrma9frTtwWxiNZIoAxC1hcOc6k1?alt=media&token=59a7e9fb-1208-4d80-ba72-2a3267d016cd"}
                    nickname={"메론츄하이"}
                    age={"21세"}
                    gender={"female"}
                    place={"서울 강남구"}
                    profileStatus={userProfile.profileStatus}
                />
                <ProfileCardItem
                    profilePictureUrl={"https://firebasestorage.googleapis.com/v0/b/seremeety-web.appspot.com/o/profile_pictures%2FJDidAIjq07S1sL7lKka7ZQ5iy7I3?alt=media&token=e9f6ad28-13c7-45fc-922a-9d47404e2198"}
                    nickname={"망고바나나"}
                    age={"20세"}
                    gender={"female"}
                    place={"서울 성북구"}
                    profileStatus={userProfile.profileStatus}
                />
            </div>
        </div>
    );
};

export default SelfIntroduction;