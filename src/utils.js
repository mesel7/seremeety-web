import { faEnvelope, faHeart, faMessage, faUser, faMusic, faGear } from "@fortawesome/free-solid-svg-icons";

export const menuItem = [
    {
        icon: faHeart,
        color: "white",
        selectedColor: "#ececec",
        dataRoute: "/matching"
    },
    {
        icon: faEnvelope,
        color: "white",
        selectedColor: "#ececec",
        dataRoute: "/request"
    },
    {
        icon: faMessage,
        color: "white",
        selectedColor: "#ececec",
        dataRoute: "/chat"
    },
    {
        icon: faUser,
        color: "white",
        selectedColor: "ececec",
        dataRoute: "/mypage"
    }
];

export const icons = {
    faMusic,
    faGear
};

export const mypageForm = [
    {
        field: "닉네임",
        type: "text",
        id: "nickname"
    },
    {
        field: "나이",
        type: "date",
        id: "birthdate"
    },
    {
        field: "성별",
        type: "radio",
        id: "gender",
        options: ["남성", "여성"]
    },
    {
        field: "MBTI",
        type: "select",
        id: "mbti",
        options: [
            "ISTJ", "ISFJ", "INFJ", "INTJ", 
            "ISTP", "ISFP", "INFP", "INTP",
            "ESTP", "ESFP", "ENFP", "ENTP",
            "ESTJ", "ESFJ", "ENFJ", "ENTJ"
        ]
    },
    {
        field: "학교",
        type: "text",
        id: "university"
    },
    {
        field: "지역",
        type: "text",
        id: "place"
    },
    {
        field: "소개 한 마디",
        type: "textarea",
        id: "introduce"
    }
];

