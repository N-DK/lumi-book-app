export type BookKind = "sample" | "pdf" | "epub"

export interface SampleChapter {
  title: string
  paragraphs: string[]
}

export interface Book {
  id: string
  title: string
  author: string
  kind: BookKind
  /** màu nền bìa (token css hoặc giá trị màu) */
  spine: string
  /** ảnh bìa đã đọc từ file, dùng data URL để lưu được trong localStorage */
  coverUrl?: string
  /** object url cho file pdf/epub do người dùng tải lên */
  fileUrl?: string
  /** file gốc để parser đọc ArrayBuffer trên client */
  file?: File
  /** nội dung cho sách mẫu */
  chapters?: SampleChapter[]
}

export interface Track {
  id: string
  title: string
  artist: string
  url: string
  coverUrl?: string
}

export interface Scene {
  id: string
  name: string
  /** css background value */
  css: string
}

/** Cảnh nền gradient/SVG dựng sẵn (mặc định) */
export const PRESET_SCENES: Scene[] = [
  {
    id: "midnight",
    name: "Đêm tím",
    css: "radial-gradient(120% 120% at 80% 0%, oklch(0.34 0.08 285) 0%, oklch(0.2 0.05 280) 45%, oklch(0.14 0.04 280) 100%)",
  },
  {
    id: "ember",
    name: "Lò sưởi",
    css: "radial-gradient(110% 110% at 20% 90%, oklch(0.45 0.12 45) 0%, oklch(0.27 0.06 40) 40%, oklch(0.16 0.03 285) 100%)",
  },
  {
    id: "forest",
    name: "Rừng đêm",
    css: "radial-gradient(120% 120% at 50% 10%, oklch(0.36 0.07 200) 0%, oklch(0.24 0.05 220) 45%, oklch(0.15 0.03 250) 100%)",
  },
  {
    id: "dawn",
    name: "Bình minh",
    css: "linear-gradient(160deg, oklch(0.55 0.1 60) 0%, oklch(0.4 0.08 35) 40%, oklch(0.24 0.05 290) 100%)",
  },
  {
    id: "ink",
    name: "Mực đêm",
    css: "linear-gradient(180deg, oklch(0.22 0.03 280) 0%, oklch(0.13 0.02 280) 100%)",
  },
  {
    id: "rosewood",
    name: "Gỗ hồng",
    css: "radial-gradient(120% 120% at 70% 20%, oklch(0.42 0.1 30) 0%, oklch(0.26 0.06 25) 50%, oklch(0.16 0.03 300) 100%)",
  },
]

const SPINES = [
  "oklch(0.45 0.12 45)", // terracotta
  "oklch(0.4 0.08 280)", // tím
  "oklch(0.42 0.09 200)", // xanh mòng két
  "oklch(0.5 0.1 140)", // xanh rêu
  "oklch(0.4 0.07 25)", // nâu đỏ
  "oklch(0.38 0.06 260)", // chàm
]

export function randomSpine(seed: number) {
  return SPINES[seed % SPINES.length]
}

/** Sách mẫu đọc được ngay, dạng hai trang giấy lật */
export const SAMPLE_BOOKS: Book[] = [
  {
    id: "sample-lofi",
    title: "Đêm Yên",
    author: "Vô Danh",
    kind: "sample",
    spine: "oklch(0.4 0.08 280)",
    chapters: [
      {
        title: "Chương một — Ngọn đèn nhỏ",
        paragraphs: [
          "Thành phố đã ngủ. Chỉ còn ô cửa sổ của tôi sáng đèn, hắt một vệt vàng ấm lên những trang giấy cũ. Bên ngoài, mưa rơi đều đều như một bản nhạc không lời.",
          "Tôi rót một tách trà, kéo chiếc ghế lại gần bàn, và mở cuốn sách ra. Mùi giấy cũ quyện cùng hơi ấm của tách trà tạo nên một thứ bình yên khó gọi tên.",
          "Có những đêm ta không cần đi đâu cả. Chỉ cần một ngọn đèn, một cuốn sách, và tiếng mưa là đủ để thấy lòng nhẹ tênh.",
        ],
      },
      {
        title: "Chương hai — Những trang giấy",
        paragraphs: [
          "Mỗi trang sách là một cánh cửa. Lật qua một trang, ta bước vào một thế giới khác, gặp những con người chưa từng quen mà thấy thân thuộc lạ kỳ.",
          "Tôi đọc chậm, để từng câu chữ ngấm vào. Đọc sách ban đêm có cái thú riêng: thế giới im ắng, chỉ còn ta và câu chuyện.",
          "Khi ngọn nến gần tàn, tôi gấp sách lại, đánh dấu trang bằng một chiếc lá khô. Ngày mai, câu chuyện sẽ đợi tôi ở đúng chỗ này.",
        ],
      },
      {
        title: "Chương ba — Sáng mai",
        paragraphs: [
          "Bình minh đến rất khẽ. Tiếng mưa đã ngừng, để lại khoảng không trong trẻo và mùi đất ẩm thoảng qua khung cửa.",
          "Tôi vươn vai, mỉm cười. Một đêm đọc sách trôi qua như một giấc mơ đẹp, và tôi biết mình sẽ còn quay lại góc đọc này nhiều lần nữa.",
          "Bởi lẽ, đọc sách không chỉ là đọc. Đó là cách ta tự pha cho mình một tách bình yên giữa cuộc đời vội vã.",
        ],
      },
    ],
  },
  {
    id: "sample-stars",
    title: "Bản Đồ Sao",
    author: "L. Hạ",
    kind: "sample",
    spine: "oklch(0.42 0.09 200)",
    chapters: [
      {
        title: "Chương một — Ánh sáng đã đi rất xa",
        paragraphs: [
          "Ngôi sao bạn thấy đêm nay có thể đã tắt từ lâu. Thứ ánh sáng ấy đã đi qua hàng nghìn năm để chạm tới mắt bạn — một lá thư cũ từ vũ trụ.",
          "Tôi nằm trên mái nhà, đếm những chấm sáng và tự hỏi có ai ở đó cũng đang nhìn về phía mình không.",
          "Bầu trời là cuốn sách lớn nhất, và mỗi vì sao là một dấu chấm câu trong câu chuyện chưa bao giờ kết thúc.",
        ],
      },
      {
        title: "Chương hai — Khoảng cách",
        paragraphs: [
          "Khoảng cách giữa các vì sao thật khó hình dung, nhưng cũng giống khoảng cách giữa con người: xa đấy, mà vẫn có thể chiếu sáng cho nhau.",
          "Tôi nghĩ về những người đã đi qua đời mình, từng rực rỡ rồi xa khuất. Ánh sáng của họ vẫn còn đây, trong cách tôi nhìn cuộc đời.",
        ],
      },
    ],
  },
]
