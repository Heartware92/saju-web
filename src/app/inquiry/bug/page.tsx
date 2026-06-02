import GeneralInquiryForm from '@/components/inquiry/GeneralInquiryForm';

export default function BugInquiryPage() {
  return (
    <GeneralInquiryForm
      category="bug"
      title="오류·버그 문의"
      intro="발생한 오류나 버그를 알려주세요. 어떤 화면에서, 어떤 기기로, 언제 발생했는지 함께 적어주시면 더 빠르게 확인할 수 있어요."
      placeholder={
        '예: 신년운세를 결제했는데 결과 화면 5번 항목부터 글자가 깨져 보여요.\n' +
        '- 사용 기기: 아이폰 15 / Safari\n' +
        '- 발생 시각: 오늘 오후 3시쯤\n' +
        '- 증상: 같은 화면에서 매번 동일하게 발생'
      }
    />
  );
}
