import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 한글 경로 문제로 Turbopack 대신 Webpack 사용
  // experimental: {
  //   turbo: false,
  // },

  // www 없는 apex(2000-saju.com) 접속을 www 로 영구 리다이렉트.
  // https apex 가 200으로 그대로 서빙되면 구글이 "중복 페이지(표준 미선택)"로 분류함 (서치콘솔 2026-07-04 통지)
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "2000-saju.com" }],
        destination: "https://www.2000-saju.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
