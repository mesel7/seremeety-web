import { useContext, useEffect, useState } from "react";
import { MypageDispatchContext, MypageStateContext } from "../contexts/MypageContext";
import PageHeader from "../components/common/PageHeader";
import MypageContent from "../components/mypage/MypageContent";
import Loading from "../components/common/Loading";

const MyProfile = () => {
    const state = useContext(MypageStateContext);
    console.log(state);
    const { onUpdate } = useContext(MypageDispatchContext);
    const [formData, setFormData] = useState({});

    useEffect(() => {
        setFormData(state);
    }, [state]);

    const onSave = (formData) => {
        onUpdate({
            ...formData,
            profileStatus: 1
        });
    };

    if (Object.keys(state).length <= 0 || Object.keys(formData).length <= 0) {
        return <Loading />;
    } else {
        return (
            <div className="MyProfile">
                <PageHeader page={"myProfile"} userProfile={formData} onSaveProfile={onSave} />
                <MypageContent userProfile={formData} setFormData={setFormData} />
            </div>
        );
    }
};

export default MyProfile;