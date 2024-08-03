import { faEnvelope, faHeart, faMessage, faUser } from "@fortawesome/free-solid-svg-icons";

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