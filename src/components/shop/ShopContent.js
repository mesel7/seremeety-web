import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons, shopItem } from "../../utils";
import "./ShopContent.css";
import ShopItem from "./ShopItem";
import BootPay from "bootpay-js";
import Swal from "sweetalert2";

const ShopContent = ({ userProfile, onUpdateCoin }) => {
    const requestPayment = (quantity, price) => {
        BootPay.request({
            price,
            application_id: "66d88be631d38115ba3fc1ed",
            name: `세레미티 ${quantity}음표`,
            pg: 'welcome',
            method: 'card',
            show_agree_window: 0,
            
            user_info: {
                phone: userProfile.phone
            },
            order_id: `order_id_${new Date().getTime()}`,
            params: {callback1: 'callback1', callback2: 'callback2', customvar1234: 'customvar1234'},
            account_expire_at: '2020-10-25',
            extra: {
                start_at: '2019-05-10',
                end_at: '2022-05-10',
                vbank_result: 1,
                quota: '0,2,3',
                theme: 'purple',
                custom_background: '#00a086',
                custom_font_color: '#ffffff'
            }
        }).error(function (data) {
            console.log(data);
            Swal.fire({
                title: "결제 실패",
                text: "결제 중 오류가 발생했습니다",
                icon: "error",
                confirmButtonText: "확인",
                customClass: {
                    confirmButton: 'no-focus-outline'
                },
            });
        }).cancel(function (data) {
            console.log(data);
        }).ready(function (data) {
            console.log(data);
        }).confirm(function (data) {
            console.log(data);
            var enable = true;
            if (enable) {
                BootPay.transactionConfirm(data);
            } else {
                BootPay.removePaymentWindow();
            }
        }).close(function (data) {
            console.log(data);
        }).done(function (data) {
            console.log(data);
            console.log("success");
            onUpdateCoin({ ...userProfile, coin: userProfile.coin + quantity});
            Swal.fire({
                title: "결제 성공",
                text: `${quantity}음표가 충전되었어요!`,
                icon: "success",
                confirmButtonText: "확인",
                customClass: {
                    confirmButton: 'no-focus-outline'
                },
            });
        });        
    };

    return (
        <div className="ShopContent">
            <div className="shop_text">
                {"음표는 세레미티 매칭 활동에 사용됩니다!"}
            </div>
            <div className="shop_coupon">
                {"쿠폰 등록"}
                <FontAwesomeIcon icon={icons.faAngleRight} />
            </div>
            {shopItem.map((it, idx) => (
                <ShopItem
                    key={idx}
                    {...it}
                    requestPayment={requestPayment}
                />
            ))}
        </div>
    );
};

export default ShopContent;