import GeneralInquiryForm from '@/components/inquiry/GeneralInquiryForm';

export default function FeedbackInquiryPage() {
  return (
    <GeneralInquiryForm
      category="feedback"
      title="제안·피드백"
      intro="서비스에 바라는 점이나 새로운 기능 아이디어를 들려주세요. 작은 의견도 큰 도움이 됩니다."
      placeholder={
        '예: 오늘의 운세 결과를 친구에게 카카오톡으로 공유하는 기능이 있으면 좋겠어요. ' +
        '결과 화면 하단에 공유 버튼이 있으면 자주 쓸 것 같아요.'
      }
    />
  );
}
