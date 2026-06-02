import GeneralInquiryForm from '@/components/inquiry/GeneralInquiryForm';

export default function OtherInquiryPage() {
  return (
    <GeneralInquiryForm
      category="other"
      title="기타 문의"
      intro="위 분류에 해당하지 않는 문의를 자유롭게 남겨주세요."
      placeholder={
        '문의하실 내용을 자유롭게 작성해주세요. ' +
        '관련된 화면이나 상황을 함께 적어주시면 더 빠르게 도와드릴 수 있어요.'
      }
    />
  );
}
