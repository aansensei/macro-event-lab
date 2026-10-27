# Dùng một màu xanh để kể chuyện bất định

Thực hành tốt nhất năm 2025 và 2026 cho một trang dữ liệu chuyên nghiệp, tối giản có thể gói trong một câu: biểu đồ là nhân vật chính, nguồn dữ liệu luôn hiện diện, một màu nhấn duy nhất mang ý nghĩa, còn mọi thứ khác là thang xám và khoảng trắng. Với dữ liệu xác suất, nghiên cứu cảm nhận thị giác ủng hộ dải phân vị có nhãn (fan chart), biểu đồ chấm rời ít chấm và biểu đồ CDF, đồng thời phản đối việc chỉ đưa một con số xác suất đơn lẻ hay dùng chuyển động rung kiểu "kim đồng hồ" của NYT năm 2016. Với Macro Event Lab, điều đó dẫn đến một hướng cụ thể: màu xanh chỉ dành cho "thị trường kỳ vọng gì", con số công bố thực tế dùng màu mực trung tính độ tương phản cao, còn bất ngờ dương và âm dùng cặp cam và tím an toàn cho người mù màu, luôn kèm dấu và nhãn. Về màu xanh chủ đạo, Carbon Blue 60 `#0f62fe` đạt đúng 5.00:1 với chữ trắng nên dùng được cho cả liên kết lẫn nút ở chế độ sáng, trong khi Radix blue-9 `#0090ff` chỉ đạt 3.26:1 và trượt ngưỡng 4.5:1 cho chữ nhỏ; ở chế độ tối phải chuyển sang Blue 40 `#78a9ff` (8.01:1 trên `#111113`). Về kỹ thuật, DuckDB-WASM nặng từ khoảng 3 đến 6 MB nén, lớn hơn nhiều so với chính các bảng gold, nên màn hình đầu tiên phải được dựng sẵn từ JSON hoặc Arrow theo từng sự kiện, còn DuckDB chỉ tải khi người dùng mở trang SQL. Đối tượng là kỹ sư và nhà tuyển dụng ở các quỹ quant: họ đánh giá cao sự chính xác có thể kiểm chứng (dấu thời gian, vintage, cách tính xác suất) hơn hiệu ứng, và việc làm tốt cả chế độ sáng lẫn tối là một tín hiệu nhỏ về sự cẩn thận kỹ thuật, vì không trang marketing nào của các quỹ được kiểm tra có chế độ tối.

**Quy ước độ tin cậy trong báo cáo.** Câu có trích dẫn nguồn là dữ kiện đã kiểm chứng từ nguồn đó. Nhãn **[suy luận]** đánh dấu kết luận hoặc đề xuất của nhóm nghiên cứu, không có nguồn trực tiếp. Nhãn **[chưa xác minh]** đánh dấu thông tin từ nguồn thứ ba, suy ngược từ CSS, hoặc chỉ đọc qua đoạn trích tìm kiếm. Nhãn **[kiểm tra CSS 2026-10-26]** đánh dấu giá trị đọc từ CSS trang chủ ngày đó, không phải thông số thương hiệu công bố. Nhãn **[tính toán]** đánh dấu tỷ lệ tương phản tính bằng công thức độ chói tương đối WCAG 2.x, một phần trong phiên nghiên cứu và một phần khi viết báo cáo này; đây là số suy ra, không phải số công bố.

## Trang dữ liệu tốt nhất coi biểu đồ là nhân vật chính và nguồn là bắt buộc

Hai tham chiếu "công cụ" chuyển giao tốt nhất là Our World in Data và FRED. Bản thiết kế lại Grapher của OWID ngày 18/10/2023 đặt **các nút chuyển Chart, Map, Table ở góc trên bên trái, điều khiển riêng của từng chế độ ở góc trên bên phải, còn tải xuống và chia sẻ ở góc dưới bên phải** (SVG, PNG, CSV, mã nhúng), và ảnh xem trước khi chia sẻ tái hiện đúng trạng thái biểu đồ gồm tab, khoảng thời gian và thực thể được chọn ([OWID](https://ourworldindata.org/redesigning-our-interactive-data-visualizations)). Nguồn dữ liệu được hiển thị trên mọi biểu đồ, kèm lớp phủ "Learn more about this data"; chế độ bảng có tiêu đề cột bấm để sắp xếp và thống kê tóm tắt khi chọn khoảng năm bằng thanh trượt ([OWID](https://ourworldindata.org/redesigning-our-interactive-data-visualizations); [OWID how-to](https://ourworldindata.org/how-to-use-our-world-in-data)). Điều đáng chú ý là ngay cả OWID, tại thời điểm phát hành 2023, vẫn liệt kê chuyển động chuyển cảnh và "trải nghiệm di động tối ưu" là việc làm sau ([OWID](https://ourworldindata.org/redesigning-our-interactive-data-visualizations)). Lưu ý cấp phép: mã Grapher hiện tại không được tự do tái sử dụng, chỉ các phiên bản cũ mang MIT ([OWID how-to](https://ourworldindata.org/how-to-use-our-world-in-data)).

FRED đi theo cùng triết lý. Bản thiết kế lại 2016 biến **đồ thị thành "ngôi sao của trang"**, chuyển các điều khiển chỉnh sửa vào một bảng bên cập nhật đồ thị ngay lập tức, và tự làm mới các chi tiết như quan sát cuối cùng ([St. Louis Fed 2016](https://www.stlouisfed.org/news-releases/2016/07/20/st-louis-feds-fred-gets-a-facelift)). Bản beta tháng 11/2024 tập trung vào khả năng tiếp cận: điều hướng bàn phím trên đồ thị đường, đầu ra cho trình đọc màn hình và độ tương phản màu đạt chuẩn ([FRED news 2024](https://news.research.stlouisfed.org/2024/11/fred-offers-enhanced-graphing/)). Cùng hệ sinh thái, ALFRED là thành phần lưu trữ vintage ([St. Louis Fed 2013](https://www.stlouisfed.org/news-releases/2013/11/20/fred-rolls-out-enhanced-graphing-functionality-and-upgraded-apps)), nhưng nhóm nghiên cứu không tìm được nguồn mô tả cách giao diện ALFRED trình bày vintage. Đây chính là khoảng trống Macro Event Lab có thể lấp: ghi rõ ngày vintage của mọi con số, điều mà đồ thị FRED thông thường không hiển thị mặc định **[suy luận]**.

Về kỷ luật hình thức, FT Visual Vocabulary chia biểu đồ thành chín quan hệ, trong đó họ **Distribution** gồm histogram, dot strip, barcode và cumulative curve, còn họ **Change over Time** có fan chart cho dự phóng ([FT chart-doctor](https://github.com/Financial-Times/chart-doctor/tree/main/visual-vocabulary)). Tài liệu này giữ bản quyền FT nên chỉ dùng làm tham chiếu ([FT chart-doctor](https://github.com/Financial-Times/chart-doctor/tree/main/visual-vocabulary)). Màu và font của FT và The Economist chỉ có từ nguồn thứ ba: FT được mô tả với nền giấy `#fff1e5` và màu claret `#990f3d` giới hạn ở các điểm nhấn nhỏ ([shadcn.io FT](https://www.shadcn.io/design/ft)), còn Economist được cho là dùng xanh `#006ba2` cho chuỗi chính và đặt trục y bên phải để giá trị mới nhất nằm cạnh số của nó ([SlideSpeak](https://slidespeak.co/slide-design-prompts/prompts/economist-style)); cả hai đều **[chưa xác minh]** vì không đọc được tài liệu chính thức. Bài học chuyển giao không phải là mã màu cụ thể mà là thói quen: một màu thương hiệu tự tin, dùng hẹp, trên nền xám.

Về thị trường dự đoán, bằng chứng mỏng nhất. Kalshi trả HTTP 429 trong phiên nghiên cứu nên không quan sát được trang thị trường; các mô tả về Polymarket (mỗi kết quả một đường riêng, tab khung thời gian từ 1H đến All, mặc định 1 tuần) đến từ tiện ích và hướng dẫn của bên thứ ba ([PolyChart](https://chromewebstore.google.com/detail/gdfcfkbghfcpbepdeehfnofadgmjbmio); [Mintlify](https://www.mintlify.com/stat-guy/polymarket/examples/price-tracking)) **[chưa xác minh]**. Quan trọng hơn, không nguồn nào được xem có thiết kế cho tổ hợp "phân phối ngụ ý từ thị trường, con số công bố lần đầu, và bản sửa đổi" trên cùng một trang. Vì vậy công thức đề xuất ở cuối báo cáo là tổng hợp, không phải sao chép một tiền lệ.

## Nghiên cứu bất định chọn dải phân vị và chấm rời thay cho kim rung

Chủ nghĩa tối giản của Tufte (tỷ lệ data-ink, chartjunk, small multiples, sparklines) vẫn là đạo đức mặc định, nhưng nhóm nghiên cứu chỉ ghi nhận nó như kiến thức nền từ các sách của ông, không xác minh qua nguồn trực tuyến trong phiên này. Bằng chứng thực nghiệm thì phức tạp hơn khẩu hiệu "ít mực hơn là tốt hơn". Bateman và cộng sự (CHI 2010) thử 14 biểu đồ ở bản trang trí và bản trơn: **bản trang trí không làm giảm độ chính xác diễn giải và được nhớ tốt hơn sau 2 đến 3 tuần** ([Bateman et al. 2010](https://vis.csail.mit.edu/classes/6.859/readings/pdfs/Bateman-UsefulJunk.pdf)). Stephen Few phản biện rằng lợi ích chỉ xuất hiện khi phần trang trí gắn với thông điệp ([Few 2011](https://webspace.science.uu.nl/~telea001/uploads/VACourse/Few11.pdf)). Hệ quả cho Macro Event Lab rõ ràng: bỏ lưới, viền và chú giải thừa, nhưng chi mực cho chú thích mang nghĩa như nhãn con số thực tế và độ lớn bất ngờ, đúng thứ một trang portfolio muốn nhà tuyển dụng nhớ **[suy luận]**.

Bằng chứng mạnh nhất cho phân phối rời rạc đến từ nhóm của Matthew Kay. Biểu đồ quantile dotplot ra đời cho dự báo xe buýt trên điện thoại; trong thí nghiệm với 320 và 221 người tham gia, **dotplot 20 chấm cho ước lượng xác suất chính xác hơn density plot khoảng 1.15 lần** (độ lệch chuẩn khoảng 11 điểm phần trăm tại p = 0.5), trong khi dotplot 100 chấm hoạt động như density vì người đọc ước lượng diện tích thay vì đếm chấm ([Kay et al. 2016](https://vis.mit.edu/classes/6.859/readings/pdfs/Kay-WhenishIsMyBus.pdf)). Chỉ ở dotplot 20 chấm, độ tự tin tương quan âm với sai số, tức người dùng tự đánh giá được độ chính xác của mình ([Kay et al. 2016](https://vis.mit.edu/classes/6.859/readings/pdfs/Kay-WhenishIsMyBus.pdf)). Trong một nhiệm vụ ra quyết định có thưởng, Fernandes và cộng sự (CHI 2018) đo được **dotplot 50 kết quả đạt 97% lợi ích tối ưu**, cao hơn nhóm không có thông tin bất định 5 điểm phần trăm, còn biểu đồ CDF đạt gần tương đương và cả hai đều vượt cách diễn đạt bằng chữ ([Fernandes et al. 2018](https://mucollective.northwestern.edu/project/uncertainty-bus)). Kay cũng tóm lược rằng người không chuyên thấy CDF xa lạ và khó ước lượng trung bình từ đó ([Kay et al. 2016](https://vis.mit.edu/classes/6.859/readings/pdfs/Kay-WhenishIsMyBus.pdf)); với khán giả là kỹ sư quant, rào cản này nhỏ hơn nhiều **[suy luận]**.

Về dải và thanh lỗi, Wilke khuyến nghị đóng khung tần suất, dùng số chấm từ ít đến vừa, ghi rõ khoảng biểu thị đại lượng nào, và cảnh báo thanh lỗi bị đọc như giới hạn cứng ("deterministic construal"); dải gradient liên tục khó đọc vì mắt không biết một mức kết thúc ở đâu ([Wilke](https://clauswilke.com/dataviz/visualizing-uncertainty.html)). Correll và Gleicher (2014) cho thấy cách mã hóa trung bình và sai số làm thay đổi đáng kể quyết định của người xem ([Correll và Gleicher 2014](https://graphics.cs.wisc.edu/Vis/ErrorBars/)). Fan chart của Bank of England, công bố từ tháng 2/1996, dùng các dải 10% đến 90% với dải trung tâm đậm nhất chứa mode ([BoE 1998](https://www.bankofengland.co.uk/-/media/boe/files/quarterly-bulletin/1998/the-inflation-report-projections-understanding-the-fan-chart)), còn Ngân hàng Quốc gia Séc dùng 30, 50, 70 và 90% ([CNB 2009](https://www.cnb.cz/en/monetary-policy/forecast/cnb-forecast-archive/CNB-forecast-February-2009-00011)); chi tiết BoE chỉ đọc qua tóm tắt tìm kiếm vì trang gốc không truy cập được **[chưa xác minh trực tiếp]**. Điểm khác biệt quan trọng: fan của BoE **mở rộng** theo tầm dự báo, còn fan của Macro Event Lab sẽ **thu hẹp** khi tiến gần giờ công bố, nên chú thích phải nói rõ điều này **[suy luận]**.

Chuyển động là vùng tranh cãi nhất. Kim đồng hồ bầu cử của NYT năm 2016 rung trong khoảng phân vị 25 đến 75 của kết quả mô phỏng, khoảng này thu hẹp dần trong đêm; Gregor Aisch lập luận chuyển động truyền đạt bất định tốt hơn liệt kê phân vị, nhưng chính ông thừa nhận đã quên một chú thích giải thích, và độc giả gọi thiết kế này là vô trách nhiệm ([vis4.net](http://www.vis4.net/blog/jittery-gauges-election-forecast/)). Hiệu ứng rung bị tắt năm 2017, sau đó trở thành tùy chọn, kèm cảnh báo rằng tắt rung chỉ che giấu bất định chứ không loại bỏ nó ([FlowingData 2018](https://flowingdata.com/2018/03/14/needle-of-uncertainty)). Ở cấp độ nghiên cứu, Robertson và cộng sự (InfoVis 2008) thấy **animation tệ nhất cho phân tích, còn small multiples chính xác nhất** ([Robertson et al. 2008](https://faculty.cc.gatech.edu/~stasko/papers/infovis08-anim.pdf)); Heer và Robertson (2007) cho thấy chuyển cảnh có phân đoạn và giữ trạng thái trung gian hợp lệ có thể cải thiện cảm nhận, nhưng không đảm bảo ([UW IDL](https://idl.uw.edu/papers/animated-transitions)). HOPs giúp so sánh hai hoặc ba đại lượng chính xác hơn thanh lỗi ([Hullman et al. 2015](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4646698/)), nhưng chuyển cảnh mượt làm xác suất khó đọc hơn, nên phải cắt nhanh ([Wilke](https://clauswilke.com/dataviz/visualizing-uncertainty.html), dẫn Kale et al. 2018). Kết quả của Brehmer và cộng sự (2019) về animation so với small multiples trên điện thoại chưa được xác nhận ([arXiv 1907.03919](https://arxiv.org/pdf/1907.03919)).

Sau 2016, các nhà dự báo lớn chuyển sang đóng khung tần suất: FiveThirtyEight 2020 mở đầu bằng lưới bản đồ kịch bản mô phỏng và "ball swarm" ([IIB Awards](https://www.informationisbeautifulawards.com/showcase/5638-fivethirtyeight-s-2020-election-forecast); [Nieman Lab](https://www.niemanlab.org/2020/07/this-is-how-fivethirtyeight-is-trying-to-build-the-right-amount-of-uncertainty-into-its-2020-election-data-analysis/)). Gelman, Hullman, Wlezien và Morris (2020) kết luận không một hình ảnh đơn lẻ nào nắm hết mọi khía cạnh bất định, nhưng một bộ hình bổ sung cho nhau thì có ích ([Hullman lab](https://www.hullmanlab.northwestern.edu/paper/2020/09/01/election-forecasts.html)). Đó là lý do cấu trúc ba biểu đồ (phân phối theo bin tại một thời điểm, fan chart theo thời gian, đường CDF theo ngưỡng) có cơ sở hơn bất kỳ biểu đồ "anh hùng" đơn lẻ nào. Để so sánh nhiều kỳ công bố, Kay và cộng sự đồng bộ trục giữa các hàng vì trục riêng từng hàng khiến dòng thời gian tương đối rất khó so sánh ([Kay et al. 2016](https://vis.mit.edu/classes/6.859/readings/pdfs/Kay-WhenishIsMyBus.pdf)), còn Datawrapper ưu tiên giải thích trong tiêu đề thay vì tiêu đề trục, và chuyển nhãn trực tiếp lên trên biểu đồ ở màn hình điện thoại ([Datawrapper Academy](https://www.datawrapper.de/academy/why-datawrapper-does-not-include-axis-labels-for-many-charts); [Datawrapper mobile first](https://www.datawrapper.de/blog/datawrapper-becomes-mobile-first-charting-tool)).

## Cảm giác cao cấp đến từ trọng lượng chữ vừa phải, viền mảnh và một màu nhấn

Các trang sản phẩm kỹ thuật và fintech cao cấp lặp lại cùng vài thói quen. Hệ Geist của Vercel tổ chức chữ theo **vai trò** (heading, label, copy, button) thay vì chỉ theo cỡ, gọi `text-label-14` và `text-copy-14` là kiểu phổ biến nhất, và yêu cầu chữ số tabular nơi con số cần khoảng cách đều ([Vercel Geist Typography](https://vercel.com/geist/typography)). Bảng màu Geist có 10 thang, mỗi thang từ 100 đến 1000 với vai trò cố định: 100 đến 300 là nền, 400 đến 600 là viền, 700 đến 800 là nền tương phản cao, 900 và 1000 là chữ ([Vercel Geist Colors](https://vercel.com/geist/colors)). Khi kiểm tra CSS trang chủ, Vercel dùng trọng lượng 550 và 450 nhiều nhất, letter-spacing âm tăng theo cỡ chữ, và max-width phổ biến nhất là 960px và 600px **[kiểm tra CSS 2026-10-26]** ([vercel.com](https://vercel.com/)); Stripe dùng Söhne với tracking -0.01em đến -0.02em và gần như không có 700; Mercury dùng các trọng lượng biến thiên 320 và 360 ([stripe.com](https://stripe.com/); [mercury.com](https://mercury.com/)). Nhóm nghiên cứu suy ra từ số liệu Vercel một quy tắc lặp lại được: khoảng -0.02em ở cỡ thân, -0.04em ở 24 đến 32px, -0.06em từ 40px trở lên **[suy luận]**, nhưng đây là quy luật của Geist; với Inter, trục `opsz` đã tự siết khoảng cách ở cỡ hiển thị.

Về màu, Stripe xây hệ thống trong CIELAB vì độ sáng HSL không khớp cảm nhận, cho mọi sắc độ cùng một đường cong độ sáng, và đặt quy tắc **hai màu cách nhau ít nhất 5 bậc là đủ cho chữ nhỏ, 4 bậc cho biểu tượng và chữ lớn** ([Stripe](https://stripe.com/blog/accessible-color-systems)). Linear năm 2024 chuyển sang sinh theme trong LCH từ ba biến (base, accent, contrast) thay vì 98 biến đặt tay, và hạn chế lượng xanh trong giao diện để có vẻ trung tính, bền thời gian ([Linear 2024](https://linear.app/now/how-we-redesigned-the-linear-ui)). Bản làm mới tháng 3/2026 làm mờ thanh bên, làm mềm viền và tóm tinh thần bằng câu "Structure should be felt not seen" ([Linear 2026](https://linear.app/now/behind-the-latest-design-refresh)), đồng thời chuyển xám từ tông lạnh ngả xanh sang tông ấm ít bão hòa, kèm cảnh báo ấm quá sẽ đục. Bài học: thang xám làm gần hết công việc, viền mảnh thay bóng đổ, màu nhấn chỉ ở liên kết, vòng focus, một nút chính và điểm nhấn dữ liệu **[suy luận]**.

Các quỹ quant tự trình bày như công ty công nghệ nghiêm túc, hướng nghiên cứu, với một chút tò mò: Jane Street "giải câu đố của thị trường toàn cầu" và không có số liệu trên trang chủ, HRT tự gọi là "công ty toán học và công nghệ", Two Sigma mở đầu trang chủ bằng ý tưởng mọi thứ bắt đầu từ một giả thuyết ([janestreet.com](https://www.janestreet.com/); [hudsonrivertrading.com](https://www.hudsonrivertrading.com/); [twosigma.com](https://www.twosigma.com/)). Optiver là mẫu tốt nhất cho cách đưa con số: một con số duy nhất (hơn 10 triệu giao dịch mỗi ngày) kèm một câu giải thích vì sao nó quan trọng ([optiver.com](https://www.optiver.com/)). Xanh là màu đáng tin trong nhóm này: Jane Street khai báo một thang xanh từ `#eff5fe` đến `#010814`, D. E. Shaw dùng `#1e52f3`, Optiver dùng navy `#011735` **[kiểm tra CSS 2026-10-26]** ([janestreet.com](https://www.janestreet.com/); [deshaw.com](https://www.deshaw.com/); [optiver.com](https://www.optiver.com/)). Không trang quỹ nào được kiểm tra có chế độ tối. Giọng văn phù hợp là khẳng định, cụ thể, tiết chế, giống tóm tắt một bài nghiên cứu hơn là marketing **[suy luận]**.

Cuối cùng là cái bẫy "trông như AI tạo": giao diện sinh tự động thường hội tụ về Inter, Roboto, Arial, gradient tím trên nền trắng và bố cục dễ đoán; cách tránh là một bảng màu chủ đạo với điểm nhấn sắc thay vì bảng màu rụt rè dàn đều. Danh sách cộng đồng bổ sung: hero căn giữa với nút CTA, ba thẻ biểu tượng, thẻ lồng trong thẻ ([925 Studios](https://www.925studios.co/blog/ai-slop-design-tells)) **[chưa xác minh]**. Có một mâu thuẫn cần nói thẳng: Linear và Raycast dùng Inter nhưng vẫn cao cấp ([linear.app](https://linear.app/); [raycast.com](https://www.raycast.com/)). Điều phân biệt họ là tinh chỉnh (Inter Display cho tiêu đề, trọng lượng biến thiên, tracking) và mọi thứ xung quanh font **[suy luận]**. Một màu xanh thật (không phải indigo), dùng nhất quán cho một ý nghĩa, chính là đối cực của mặc định tím chung chung.

## Carbon Blue 60 đạt 5.00:1 với chữ trắng, Radix blue-9 chỉ đạt 3.26:1

Về font, Inter mang giấy phép SIL OFL 1.1, có bản biến thiên `InterVariable` với trọng lượng từ 100 đến 900 và trục `opsz` từ "text" đến "display" (gộp Inter Display từ v4.0), và công bố đầy đủ tính năng số: `tnum` với **độ rộng chữ số giữ nguyên ở mọi trọng lượng**, `zero` số 0 có gạch, `case` nâng ngoặc lên ngang chữ hoa và chữ số, cùng các bộ phân biệt ký tự `ss02`, `ss04`, `cv05`, `cv08` ([rsms.me/inter](https://rsms.me/inter/); [Inter v4.0](https://github.com/rsms/inter/releases/tag/v4.0)). IBM Plex (OFL) có Sans, Serif, Mono, Sans Condensed và Math, nhưng README không nhắc đến chữ số tabular hay số 0 có gạch ([IBM Plex](https://github.com/IBM/plex)). Geist và Geist Mono (OFL 1.1, 9 trọng lượng, Mono "tinh chỉnh cho code và nội dung dạng bảng") cũng không nêu `tnum` hay `zero` trên trang chính thức ([vercel.com/font](https://vercel.com/font)). Vì thế, Inter là lựa chọn duy nhất trong ba font mà tính năng số được **công bố**, điều quan trọng khi con số đổi liên tục theo thanh trượt. CSS `font-variant-numeric` (ánh xạ `tabular-nums` sang `tnum`, `slashed-zero` sang `zero`) đã khả dụng rộng rãi trên trình duyệt từ tháng 1/2020 ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric)).

Thang chữ của các hệ thống dùng line-height cố định theo lưới 4px. Radix Themes đi từ 12/16, 14/20, 16/24, 18/26, 20/28, 24/30, 28/36, 35/40 đến 60/60, với letter-spacing âm dần ở cỡ lớn ([Radix Themes](https://www.radix-ui.com/themes/docs/theme/typography)). Carbon có bộ "productive" cơ sở 14px cho giao diện dày đặc và "expressive" cơ sở 16px, với `body-02` là 16/24 và `code-01` là IBM Plex Mono 12/16 ([Carbon type sets](https://carbondesignsystem.com/elements/typography/type-sets/)).

Về độ tương phản, WCAG 2.2 vẫn là chuẩn có thể trích dẫn. SC 1.4.11 yêu cầu **3:1 cho thành phần giao diện và đồ họa cần thiết để hiểu nội dung**, ngưỡng không làm tròn (2.999:1 là trượt), đường trong biểu đồ đường kể cả lưới cần để đọc giá trị phải đạt 3:1, và có ngoại lệ khi thông tin đã có ở dạng khác như bảng hay nhãn chữ ([W3C 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)). Carbon diễn đạt lại: chữ dưới 24px cần 4.5:1, chữ lớn và đồ họa cần 3:1 ([Carbon color](https://carbondesignsystem.com/elements/color/overview/)). Bản nháp WCAG 3.0 ngày 10/9/2026 ghi rằng thuật toán tương phản vẫn chưa được xác định và không tham chiếu APCA ([W3C WCAG 3.0](https://www.w3.org/TR/WCAG3/)), nên APCA chỉ là kiểm tra phụ.

Đây là điểm then chốt cho bảng màu xanh. Radix Colors có thang 12 bậc với vai trò rõ ràng (1 đến 2 nền, 3 đến 5 nền tương tác, 6 đến 8 viền, 9 đến 10 màu đặc, 11 đến 12 chữ), và nói phần lớn màu bậc 9 được thiết kế cho chữ trắng ([Radix scale](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale)). Nhưng **chữ trắng trên Radix blue-9 `#0090ff` chỉ đạt 3.26:1** **[tính toán]**, trượt 4.5:1 cho chữ thường, chỉ đạt cho chữ lớn và đồ họa. Ngược lại, **Carbon Blue 60 `#0f62fe` đạt 5.00:1 theo cả hai chiều với trắng** **[tính toán]** và chính là token `$interactive`, `$link-primary`, `$focus` của theme White ([Carbon tokens](https://carbondesignsystem.com/elements/color/tokens/)). Ở chế độ tối, Blue 60 trên nền `#161616` tụt xuống 3.62:1 trong khi Blue 40 `#78a9ff` đạt 7.68:1 **[tính toán]**; Radix blue-11 tối `#70b8ff` đạt 8.97:1 trên `#111113`, Primer `#4493f8` đạt 6.11:1 trên `#0d1117` **[tính toán]** ([Radix blue-dark](https://unpkg.com/@radix-ui/colors@3.0.0/blue-dark.css); [Primer dark](https://unpkg.com/@primer/primitives/dist/css/functional/themes/dark.css)). Tính lại cho nền tối đề xuất `#111113`, Blue 40 đạt 8.01:1 và Blue 60 đạt 3.77:1 **[tính toán]**. Khi quy đổi sang OKLCH, `#0f62fe` có sắc độ khoảng 262, `#0090ff` khoảng 252 và blue-700 của Vercel khoảng 258 **[tính toán]**: Carbon sâu và "định chế" hơn, Radix sáng và ngả xanh da trời hơn, nhưng cả hai đều cách xa vùng indigo (nhóm nghiên cứu suy ra là khoảng 270 đến 280) **[suy luận]**.

Chế độ tối đúng cách là một thang được thiết kế riêng, không phải đảo màu. Radix, Primer và Carbon đều làm vậy: nền gần đen ngả xanh xám (`#111113`, `#0d1117`), bề mặt cao hơn thì sáng hơn, màu nhấn chuyển sang sắc nhạt hơn cho chữ ([Radix slate-dark](https://unpkg.com/@radix-ui/colors@3.0.0/slate-dark.css); [Primer dark](https://unpkg.com/@primer/primitives/dist/css/functional/themes/dark.css); [Carbon color](https://carbondesignsystem.com/elements/color/overview/)). Material 2 khuyến nghị nền `#121212`, giảm bão hòa màu chính và biểu thị độ cao bằng lớp phủ sáng hơn ([Material 2](https://m2.material.io/design/color/dark-theme)), nguồn này chỉ đọc qua đoạn trích **[chưa xác minh trực tiếp]**. Với dữ liệu, Carbon đảo hướng thang tuần tự ở theme tối (sáng nhất là giá trị lớn nhất) nhưng giữ nguyên thang phân kỳ, và không khuyến khích gradient ([Carbon data viz](https://carbondesignsystem.com/data-visualization/color-palettes/)).

Về an toàn mù màu, ColorBrewer gắn cờ `blind` cho RdBu, PuOr, Blues, BrBG và RdYlBu ([ColorBrewer](https://raw.githubusercontent.com/axismaps/colorbrewer/master/colorbrewer_schemes.js)); bảng Okabe-Ito (xanh `#0072B2`, vermillion `#D55E00`, cam `#E69F00`, xanh trời `#56B4E9`) chỉ có từ nguồn tổng hợp thứ cấp **[chưa xác minh trực tiếp]** ([NYU Siegal lab](https://siegal.bio.nyu.edu/color-palette/)). Một phát hiện khi viết báo cáo này làm thay đổi lựa chọn: **Okabe Blue `#0072B2` và Carbon Blue 60 `#0f62fe` gần như cùng độ chói (1.04:1)** **[tính toán]**, nên nếu "bất ngờ dương" dùng xanh Okabe, nó sẽ lẫn với màu "thị trường kỳ vọng". Cặp PuOr đầu mút `#b35806` (cam) và `#542788` (tím) vừa khác sắc, vừa chênh độ chói 2.13:1 **[tính toán]**, tức vẫn phân biệt được khi in xám. Vì vậy báo cáo đề xuất PuOr cho bất ngờ, giữ xanh độc quyền cho thị trường.

Về hệ thống thành phần, Radix Colors (CSS thuần, MIT), Radix Themes (MIT), shadcn/ui (MIT, chép mã vào repo, biến CSS theo cặp `--primary`/`--primary-foreground`, có sẵn `--chart-1` đến `--chart-5`, dùng cú pháp Tailwind v4) và Primer React (MIT) đều dùng được; Carbon (Apache 2.0) và Primer mang bản sắc IBM và GitHub rất mạnh; giấy phép thư viện thành phần Geist không được nêu ([Radix Themes](https://github.com/radix-ui/themes); [shadcn/ui theming](https://ui.shadcn.com/docs/theming); [Primer React](https://github.com/primer/react); [Carbon](https://github.com/carbon-design-system/carbon); [Vercel Geist](https://vercel.com/geist/introduction)).

## DuckDB-WASM nặng hơn dữ liệu gold, nên màn hình đầu phải là dữ liệu dựng sẵn

Bản ổn định DuckDB-WASM là 2.0.0, với ba bundle: `mvp` chạy mọi nơi, `eh` dùng exception handling để nhanh hơn, `coi` có luồng nhưng cần header `Cross-Origin-Opener-Policy: same-origin` và `Cross-Origin-Embedder-Policy: require-corp`, và đa luồng vẫn được mô tả là thử nghiệm ([DuckDB instantiation](https://duckdb.org/docs/2.0/clients/wasm/instantiation.html); [DuckDB overview](https://duckdb.org/docs/2.0/clients/wasm/overview.html)). Kích thước là vấn đề: một maintainer báo `duckdb-eh.wasm` (bản dev 1.28.1) **34.6 MB chưa nén, 6.4 MB nén**, và một người dùng bị chặn bởi giới hạn 25 MB mỗi file của Cloudflare Pages đã chuyển sang SQLite ([observablehq/framework #1260](https://github.com/observablehq/framework/issues/1260)). Cloudflare Pages Free đặt **25 MiB tối đa mỗi tài sản** ([Cloudflare limits](https://developers.cloudflare.com/pages/platform/limits/)). Không có bảng kích thước chính thức cho 2.0.0, nên phải đo trong `node_modules`. Trên Safari, khi `memory.grow()` thất bại, WebKit có thể giết hoặc tải lại cả tab thay vì ném lỗi bắt được ([WebKit 221530](https://bugs.webkit.org/show_bug.cgi?id=221530)), và bộ nhớ chia sẻ mà bản đa luồng dùng từng lỗi hết bộ nhớ trên iOS 16.4 ([WebKit 255103](https://bugs.webkit.org/show_bug.cgi?id=255103)). Kết luận của nhóm: nếu toàn bộ bảng gold chỉ vài trăm KB đến vài MB, **động cơ truy vấn tốn nhiều byte hơn chính dữ liệu**, nên dựng sẵn JSON hoặc Arrow cho màn hình đầu và chỉ tải DuckDB lười khi mở trang SQL **[suy luận]**. Điều này lệch với ROADMAP tuần 4 ("nạp bảng gold bằng DuckDB-WASM"), và nên sửa roadmap: DuckDB vẫn là điểm trình diễn kỹ thuật, nhưng thuộc về trang 8 (SQL Playground), không chặn lần vẽ đầu.

Thư viện biểu đồ cũng chênh lệch lớn. Số chính thức duy nhất là của Plotly.js 4.1.2: **bản `basic` đã 401 kB min+gzip, bản đầy đủ 1.49 MB** ([plotly.js dist](https://github.com/plotly/plotly.js/blob/master/dist/README.md)). Các số khác đến từ bảng so sánh của nhà cung cấp (TanStack, tháng 7/2026) và nên tự đo lại: uPlot khoảng 22 KB, `@visx/xychart` khoảng 49 KB, Observable Plot khoảng 85 đến 94 KB, Vega-Lite khoảng 87 KB chưa kể runtime Vega, Recharts và ECharts trong khoảng 136 đến 177 KB tùy nguồn ([TanStack](https://tanstack.com/charts/latest/docs/comparison); [PkgPulse](https://www.pkgpulse.com/compare/visx__visx-vs-recharts)) **[chưa xác minh]**. Ngưỡng Core Web Vitals không đổi: **LCP tối đa 2.5 s, INP tối đa 200 ms, CLS tối đa 0.1, tính ở phân vị 75** ([web.dev](https://web.dev/articles/defining-core-web-vitals-thresholds)).

Về tương tác, mẫu thanh trượt của WAI-ARIA APG yêu cầu `role="slider"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, khuyên dùng `aria-valuetext` khi con số không thân thiện, hỗ trợ mũi tên, Home, End, PageUp, PageDown, và cảnh báo rằng một số công nghệ hỗ trợ cảm ứng có thể không hỗ trợ cử chỉ của thanh trượt tự viết ([APG slider](https://www.w3.org/WAI/ARIA/apg/patterns/slider/)). Chartability đòi hỏi chuyển động dài hơn 2 giây hoặc lặp lại phải tạm dừng được, chuyển cảnh dữ liệu dài **từ 250 ms đến 2 s**, focus phản chiếu hover, chỉ báo focus đạt 4.5:1, và không có chữ nhỏ hơn 12px ([Chartability](https://github.com/Chartability/POUR-CAF)). WCAG 2.5.8 yêu cầu vùng chạm tối thiểu **24 x 24 CSS px**, thanh trượt tính là một vùng chạm, và biểu đồ dày đặc có thể thuộc ngoại lệ "essential" ([W3C 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)). Về hosting, Cloudflare Pages hỗ trợ header tùy chỉnh qua `_headers` và không công bố giới hạn băng thông, còn GitHub Pages giới hạn site 1 GB, băng thông mềm 100 GB mỗi tháng và tài liệu không nhắc header tùy chỉnh ([Cloudflare headers](https://developers.cloudflare.com/pages/configuration/headers/); [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)). Nếu bỏ bundle `coi`, cả hai đều dùng được.

## Hướng thiết kế đề xuất cho Macro Event Lab

Toàn bộ mục này là đề xuất **[suy luận]** xây trên các dữ kiện đã trích dẫn ở trên. Mã hex đều lấy từ Carbon, Radix Colors 3.0.0 hoặc ColorBrewer như đã dẫn; tỷ lệ tương phản là **[tính toán]**. Giả định: giao diện site viết bằng tiếng Anh vì khán giả là nhà tuyển dụng và kỹ sư ở Mỹ, nên ví dụ chữ trên giao diện để nguyên tiếng Anh.

### Nguyên tắc thiết kế

1. **Một màu, một nghĩa.** Xanh luôn có nghĩa "thị trường kỳ vọng" hoặc "có thể tương tác". Con số thực tế là mực trung tính đậm nhất. Bất ngờ dùng cam và tím. Không màu nào được dùng để trang trí.
2. **Không bao giờ đưa một xác suất đơn lẻ.** Mỗi con số kỳ vọng đi kèm khoảng (khoảng 50% của phân phối) và câu đọc bằng lời.
3. **Biểu đồ là nhân vật chính, nguồn là bắt buộc.** Mọi biểu đồ có tiêu đề, dòng nguồn, ngày vintage, và chế độ bảng.
4. **Tĩnh trước, chuyển động sau.** Mặc định là trạng thái tĩnh có thể kéo; nút Play là tùy chọn, không tự chạy.
5. **Nhìn được ngay, kiểm chứng được sâu.** Nhà tuyển dụng đọc dải số ở đầu trang trong năm giây; kỹ sư mở "About this data", tải CSV hoặc vào trang SQL.
6. **Cấu trúc bằng căn lề và viền mảnh,** không bằng thẻ, bóng đổ hay gradient.
7. **Di động là chuẩn, không phải phiên bản thu nhỏ.** Thiết kế từ 360 đến 390px trước, kiểm tra ở 320px.

### Bảng màu

Nền tảng: thang xanh Carbon Blue 10 đến 100 cho màu chính, thang xám Radix slate (xám ngả xanh, hài hòa với màu chính) cho nền, viền và chữ. Thang xanh đầy đủ: Blue 10 `#edf5ff`, 20 `#d0e2ff`, 30 `#a6c8ff`, 40 `#78a9ff`, 50 `#4589ff`, 60 `#0f62fe`, 70 `#0043ce`, 80 `#002d9c`, 90 `#001d6c`, 100 `#001141` ([Carbon data viz](https://carbondesignsystem.com/data-visualization/color-palettes/)).

| Vai trò | Sáng | Tương phản (sáng) | Tối | Tương phản (tối) |
|---|---|---|---|---|
| Nền trang | `#ffffff` | | `#111113` (slate-1 dark) | |
| Bề mặt phụ (bảng sọc, khối code, thanh điều khiển) | `#f9f9fb` (slate-2) | | `#18191b` (slate-2 dark) | |
| Bề mặt hover | `#f0f0f3` (slate-3) | | `#212225` (slate-3 dark) | |
| Viền phân cách, lưới trang trí | `#d9d9e0` (slate-6) | 1.40:1, chỉ trang trí | `#363a3f` (slate-6 dark) | 1.65:1, chỉ trang trí |
| Viền điều khiển, trục nền | `#8b8d98` (slate-9) | 3.30:1 | `#696e77` (slate-9 dark) | 3.68:1 |
| Chữ chính | `#1c2024` (slate-12) | 16.39:1 (15.58 trên bề mặt phụ) | `#edeef0` (slate-12 dark) | 16.25:1 (15.15 trên bề mặt phụ) |
| Chữ phụ, dòng nguồn | `#60646c` (slate-11) | 5.94:1 (5.65 trên bề mặt phụ) | `#b0b4ba` (slate-11 dark) | 9.06:1 (8.45 trên bề mặt phụ) |
| Liên kết, chữ nhấn | `#0f62fe` (Blue 60) | 5.00:1 (4.76 trên bề mặt phụ) | `#78a9ff` (Blue 40) | 8.01:1 (7.47 trên bề mặt phụ) |
| Nút chính: nền / chữ | `#0f62fe` / `#ffffff` | 5.00:1 | `#0f62fe` / `#ffffff` | 5.00:1; viền nút so với nền 3.77:1 |
| Nút chính hover / active | `#0043ce` / `#002d9c` | chữ trắng 7.79:1 / 11.32:1 | `#0043ce` | chữ trắng 7.79:1 |
| Chip đang chọn: nền / chữ / viền | `#edf5ff` / `#0043ce` / `#0f62fe` | chữ 7.09:1, viền 4.55:1 | `#001d6c` / `#a6c8ff` / `#78a9ff` | chữ 8.85:1 |
| Vòng focus (2px, offset 2px) | `#0f62fe` | 5.00:1 | `#78a9ff` | 8.01:1 |
| Thị trường ngụ ý: cột xác suất | `#0f62fe` | 5.00:1 | `#4589ff` (Blue 50) | 5.64:1 |
| Dải fan 90% | `#d0e2ff` (Blue 20) | 1.31:1, cần nhãn và bảng | `#002d9c` (Blue 80) | 1.67:1, cần nhãn và bảng |
| Dải fan 50% | `#a6c8ff` (Blue 30) | 1.70:1, cần nhãn và bảng | `#0043ce` (Blue 70) | 2.42:1, cần nhãn và bảng |
| Đường trung vị | `#0043ce` (Blue 70) | 7.79:1; 4.58:1 trên dải 50% | `#a6c8ff` (Blue 30) | 11.07:1; 4.58:1 trên dải 50% |
| Con số thực tế lần đầu (đường, chấm đặc) | `#1c2024` | 16.39:1; 9.62:1 trên dải 50% | `#edeef0` | 16.25:1; 6.71:1 trên dải 50% |
| Bản sửa đổi (chấm rỗng, nét đứt) | `#60646c` | 5.94:1 | `#b0b4ba` | 9.06:1 |
| Cột "ma" T-7d (chỉ viền) | `#8b8d98` | 3.30:1 | `#777b84` (slate-10 dark) | 4.45:1 |
| Bất ngờ dương (thực tế cao hơn kỳ vọng) | `#b35806` (PuOr cam) | 4.87:1 (4.63 trên bề mặt phụ) | `#e08214` (PuOr cam nhạt) | 6.62:1 |
| Bất ngờ âm (thực tế thấp hơn kỳ vọng) | `#542788` (PuOr tím) | 10.38:1 (9.87 trên bề mặt phụ) | `#b2abd2` (PuOr tím nhạt) | 8.67:1 |

Ghi chú về tương phản. Dải fan sáng không đạt 3:1 so với nền ở cả hai chế độ; điều này chấp nhận được theo ngoại lệ của SC 1.4.11 khi mỗi dải có nhãn chữ trực tiếp ("50% of probability", "90%") và có bảng dữ liệu thay thế, còn đường trung vị và con số thực tế đều vượt 4.5:1 ([W3C 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)). Chế độ tối áp dụng quy tắc của Carbon: dải trong (xác suất dày hơn) sáng hơn dải ngoài. Slate-10 tối `#777b84` đạt 4.45:1, hụt 4.5:1 một chút, nên chỉ dùng cho viền đồ họa, không cho chữ nhỏ. Lưới `#d9d9e0` và `#363a3f` được coi là trang trí, vì mọi giá trị cần đọc đều có nhãn; nếu một đường lưới mang nghĩa (ví dụ mốc 0), dùng màu trục `#8b8d98` hoặc `#696e77`. Hai màu bất ngờ tối (`#e08214` và `#b2abd2`) chênh độ chói chỉ 1.31:1, nên ở chế độ tối dấu "+" và "−" cùng vị trí trái phải là bắt buộc, không phải tùy chọn. Chưa chạy mô phỏng mù màu (deuteranopia, protanopia, tritanopia) cho các cặp này; nên kiểm bằng công cụ mô phỏng trước khi chốt. Thêm `<meta name="color-scheme" content="light dark">` và `theme-color` `#ffffff` / `#111113`.

```css
:root {
  --bg: #ffffff; --surface: #f9f9fb; --surface-hover: #f0f0f3;
  --border: #d9d9e0; --border-control: #8b8d98;
  --text: #1c2024; --text-muted: #60646c;
  --accent: #0f62fe; --accent-hover: #0043ce; --accent-active: #002d9c;
  --focus: #0f62fe;
  --market: #0f62fe; --band-90: #d0e2ff; --band-50: #a6c8ff; --median: #0043ce;
  --actual: #1c2024; --revision: #60646c; --ghost: #8b8d98;
  --surprise-up: #b35806; --surprise-down: #542788;
}
/* dark tokens apply when the OS prefers dark and the user has not forced light */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #111113; --surface: #18191b; --surface-hover: #212225;
    --border: #363a3f; --border-control: #696e77;
    --text: #edeef0; --text-muted: #b0b4ba;
    --accent: #78a9ff; --accent-hover: #0043ce; --accent-active: #002d9c;
    --focus: #78a9ff;
    --market: #4589ff; --band-90: #002d9c; --band-50: #0043ce; --median: #a6c8ff;
    --actual: #edeef0; --revision: #b0b4ba; --ghost: #777b84;
    --surprise-up: #e08214; --surprise-down: #b2abd2;
  }
}
/* the same dark values are repeated under :root[data-theme="dark"] for the manual toggle */
```

Lưu ý: `--accent` tối `#78a9ff` dùng cho chữ và liên kết; nút chính ở chế độ tối dùng một token riêng (`--button-bg: #0f62fe`, chữ trắng).

### Chữ: font, thang cỡ và tính năng OpenType

Stack đề xuất: `font-family: "InterVariable", "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;` với `font-optical-sizing: auto` để trục `opsz` tự chuyển sang dáng Display ở cỡ lớn. Mono, chỉ cho ticker Kalshi, mã chuỗi ALFRED và SQL: `"IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace` (Carbon dùng Plex Mono cho code ([Carbon type sets](https://carbondesignsystem.com/elements/typography/type-sets/)); phải kiểm tra file font có `zero` hay không trước khi chốt). Tự host một file WOFF2 biến thiên, cắt chỉ bộ Latin, preload, `font-display: swap`; Plex Mono tải lười vì không nằm trên màn hình đầu.

| Vai trò | Cỡ / line-height | Trọng lượng | Letter-spacing | Dùng cho |
|---|---|---|---|---|
| micro | 12 / 16 | 400 | 0.0025em | Nhãn trục, dòng nguồn, chú thích (không nhỏ hơn 12px) |
| label | 14 / 20 | 500 | 0 | Nhãn điều khiển, tiêu đề cột, chip |
| body-sm | 14 / 20 | 400 | 0 | Ô bảng, chú thích biểu đồ |
| body | 16 / 24 | 400 | 0 | Văn bản, câu tóm tắt biểu đồ |
| lead | 18 / 26 | 400 | -0.0025em | Câu mở đầu trang Method |
| h3 | 20 / 28 | 500 | -0.005em | Tiêu đề biểu đồ |
| h2 | 24 / 30 | 500 | -0.00625em | Tiêu đề mục; số KPI trên điện thoại |
| h1 | 28 / 36 | 600 | -0.0075em | Tên sự kiện |
| số anh hùng | 35 / 40 | 600 | -0.01em | "Market expected" và "First print" trên desktop |

Cỡ và line-height lấy từ Radix Themes ([Radix Themes](https://www.radix-ui.com/themes/docs/theme/typography)); trọng lượng 500 đến 600 theo thói quen tiết chế của Vercel và Stripe **[kiểm tra CSS 2026-10-26]**, không dùng 700. Văn bản giới hạn `max-width: 70ch`, dưới trần 80 ký tự của WCAG 1.4.8 ([WCAG 2.2](https://www.w3.org/TR/WCAG22/#visual-presentation)).

Quy tắc số: mọi con số trong bảng, nhãn trục, KPI và ô đọc giá trị của thanh trượt dùng `font-variant-numeric: tabular-nums lining-nums` và căn phải; ticker và mã chuỗi thêm `slashed-zero`; nhãn trộn chữ hoa, số và ngoặc như "CPI (m/m)" dùng `font-feature-settings: "case" 1`. Ưu tiên `font-variant-numeric` hơn `font-feature-settings` vì thuộc tính sau ghi đè tính năng thừa kế khi khai báo nhiều lần. Dùng dấu trừ thật U+2212 cho số âm, luôn hiện "+" cho bất ngờ dương, cố định số chữ số thập phân theo cột (xác suất 0 chữ số trên nhãn biểu đồ, 1 chữ số trong bảng; CPI 1 chữ số; NFP theo nghìn), đặt đơn vị ở tiêu đề cột ("%", "k", "bp"), ghi múi giờ "ET" rõ ràng.

### Lưới, độ rộng, khoảng cách, breakpoint

Khung nội dung tối đa 1200px, văn bản tối đa 640px (khoảng 70 ký tự), biểu đồ chiếm toàn khung. Lề hai bên 16px trên điện thoại, 24px trên máy tính bảng, 32px trên desktop. Thang khoảng cách cơ sở 4px: 4, 8, 12, 16, 24, 32, 48, 64. Bo góc 6px cho điều khiển, 8px cho khối dữ liệu, không vượt 12px. Breakpoint: dưới 640px một cột; từ 640 đến 1023px điều khiển nằm cạnh biểu đồ; từ 1024px có cột bên danh sách sự kiện; dùng `@container` cho thẻ biểu đồ để nó tự thích nghi bất kể đặt ở đâu. Tỷ lệ khung biểu đồ cố định bằng `aspect-ratio` (16/10 trên desktop, 4/5 trên điện thoại) để CLS bằng 0. Toàn bộ thông số trong đoạn này là đề xuất, không có nguồn trực tiếp ngoài việc Radix và Carbon dùng lưới 4px và các trang tham chiếu dùng cột đọc 600 đến 640px trong khung 960 đến 1280px.

### Quy tắc biểu đồ

**Fan chart (tiến triển theo giờ).** Trục x là "giờ trước công bố" từ T-7d đến T, trục y là giá trị chỉ số (ví dụ CPI m/m). Hai dải: 50% (phân vị 25 đến 75) và 90% (phân vị 5 đến 95), mỗi dải có nhãn trực tiếp ở mép phải; tối đa ba mức dải theo khuyến nghị của Wilke. Đường trung vị đậm hơn. Con số thực tế lần đầu là một đường ngang màu `--actual` kéo dài qua mốc công bố, có nhãn "First print 0.4%"; bản sửa đổi là chấm rỗng nét đứt. Một đường dọc đánh dấu "Release 08:30 ET" và một con trỏ dọc mảnh cho thời điểm đang chọn trên thanh trượt. Nhãn giá trị cuối đặt ở mép phải (thói quen trục phải của Economist, **[chưa xác minh]**). Chú thích phải nói rõ fan này thu hẹp dần về giờ công bố. Phân vị phải tính ở bước build bằng nội suy tuyến tính trong bin; nếu bin đuôi để mở (ví dụ "0.6% or more"), phân vị 5 hoặc 95 có thể không xác định, khi đó đánh dấu và chỉ vẽ dải 50%. Trên điện thoại chỉ giữ dải 50% và 90%, không thêm dải thứ ba.

**Biểu đồ xác suất theo bin (phân phối tại một thời điểm).** Cột xếp theo giá trị kết quả, không theo xác suất; in xác suất trực tiếp trên hoặc cạnh mỗi cột ("0.3%: 42%"). Cột "ma" chỉ viền cho phân phối T-7d giúp so sánh trước và sau mà không cần chuyển động. Sau công bố, bin chứa con số thực tế được viền bằng `--actual` và có nhãn, đường dọc liền cho con số đầu tiên, nét đứt cho bản sửa đổi. Trên điện thoại xoay thành cột ngang: nhãn bin bên trái, xác suất bên phải. Tùy chọn một chế độ quantile dotplot 20 chấm (mỗi chấm là 5%) cho người đọc thích đếm; không dùng 100 chấm ([Kay et al. 2016](https://vis.mit.edu/classes/6.859/readings/pdfs/Kay-WhenishIsMyBus.pdf)). Có công tắc "Raw / Normalized": giá các bucket Kalshi có thể không cộng đúng 100% do phí và chênh lệch giá mua bán, nên ghi chú cách chuẩn hóa (nhận định này là **[suy luận]**, chưa có nguồn).

**Biểu đồ ngưỡng / CDF.** Với hợp đồng ngưỡng P(X > k), vẽ hàm vượt ngưỡng dạng bậc thang giảm dần, có chấm tại mỗi strike; xác suất bin là hiệu của hai ngưỡng kề nhau, và tooltip hoặc chú thích cho thấy phép trừ đó để kỹ sư kiểm tra tổng bằng 100%. Đây là biểu đồ dành cho chuyên gia; Fernandes và cộng sự thấy CDF gần ngang dotplot cho quyết định ([Fernandes et al. 2018](https://mucollective.northwestern.edu/project/uncertainty-bus)).

**FOMC, kết quả rời rạc.** Các kết quả (ví dụ cắt 50, cắt 25, giữ nguyên, tăng 25) có thứ tự, nên dùng thanh ngang xếp chồng 100% cho một thời điểm và vùng xếp chồng theo thời gian, tô bằng các bậc xanh theo thứ tự (Blue 30, 50, 70, 90 ở chế độ sáng), mỗi đoạn có nhãn trực tiếp và đường phân cách 1px màu nền để ranh giới đạt yêu cầu 1.4.11. Kết quả thực tế được viền `--actual` với nhãn "Decision". Không dùng ẩn dụ đồng hồ đo hay kim.

**Chú thích.** Mỗi biểu đồ có tiêu đề dạng câu nói điều cần thấy, một câu tóm tắt sinh tự động (ví dụ "At T-48h the market put 46% on 0.3% m/m, up from 38% a week earlier."), dòng nguồn ("Sources: Kalshi KXCPI snapshots; BLS CPI via ALFRED, vintage 2026-10-14"), và một ghi chú "How to read this chart" thu gọn được. Nhãn trực tiếp thay chú giải; không dùng trục y kép.

**Small multiples.** Trang tổng quan: mỗi kỳ công bố một ô nhỏ, cùng trục x cho cùng một chỉ số, xếp theo thời gian, hiển thị phân phối tại T-1h và con số thực tế. Thêm một dải tóm tắt bất ngờ: mỗi kỳ là một chấm, x là bất ngờ tính theo độ lệch chuẩn của phân phối ngụ ý, màu cam hoặc tím kèm dấu. Trên điện thoại: một cột, mỗi hàng một ô cỡ sparkline kèm con số thực tế và bất ngờ bằng chữ. Animation chỉ dành cho "replay" của một kỳ, không bao giờ để so sánh giữa các kỳ ([Robertson et al. 2008](https://faculty.cc.gatech.edu/~stasko/papers/infovis08-anim.pdf)).

**Phản ứng thị trường.** ROADMAP giai đoạn 2 lấy DGS2 và DGS10 từ FRED, vốn là chuỗi theo ngày, nên phản ứng phải trình bày là thay đổi trong ngày công bố (cột hoặc chấm có nhãn bp), không phải đường trong ngày giả vờ có độ phân giải theo phút.

**Thanh trượt thời gian và animation.** Dùng `<input type="range">` gốc, bước 1 giờ, có `aria-valuetext` dạng "48 hours before CPI release, Oct 12 08:30 ET". Bốn chip đặt sẵn: T-7d, T-1d, T-1h, Final (đáp ứng 2.5.7 vì có phương án không cần kéo). Dòng "As of ..." hiển thị cố định phía trên biểu đồ bin. Trục y của mỗi sự kiện cố định cho mọi thời điểm, không bao giờ đổi tỷ lệ giữa chừng. Nút Play là `<button>` có nhãn đổi giữa "Play" và "Pause", tắt mặc định, dừng ở cuối thay vì lặp, mỗi khung chuyển trong khoảng 250 ms (cận dưới của Chartability), chỉ đổi chiều cao cột. Không có hiệu ứng rung. Mỗi lần kéo chỉ hoán đổi mảng đã tính sẵn, vẽ lại qua `requestAnimationFrame`. Trạng thái nằm trong URL, ví dụ `?event=cpi-2026-09&t=-48h&view=chart`, dùng `history.replaceState` khi kéo và `pushState` khi đổi sự kiện.

**Giảm chuyển động.** Dưới `@media (prefers-reduced-motion: reduce)`: tắt mọi tween, cột đổi tức thì, Play chuyển thành bước thủ công. Vùng `aria-live="polite"` chỉ đọc giá trị khi người dùng dừng hoặc bấm từng bước, không đọc mỗi khung.

### Trang 1 Event Explorer

Desktop (từ 1024px). Số liệu trong khung là minh họa.

```
+------------------------------------------------------------------------------------+
| Macro Event Lab          Events   Compare   Method   Data   SQL      [Sys|Lt|Dk]    |
+---------------+--------------------------------------------------------------------+
| EVENTS        |  CPI, September 2026          Released Oct 14 2026, 08:30 ET       |
| [CPI][NFP]    |                                                                    |
| [FOMC]        |  MARKET EXPECTED (T-1h)   FIRST PRINT            SURPRISE          |
|               |  0.3% m/m                 0.4% m/m               +1.6 SD           |
| > Sep 2026    |  50% range 0.2 to 0.4     ALFRED 2026-10-14      above implied     |
|   Aug 2026    |                           Revised 0.3% (Nov 13)  mean              |
|   Jul 2026    +------------------------------------------+-------------------------+
|   Jun 2026    | Implied distribution, last 7 days        | As of Oct 12 08:30 ET   |
|   ...         |                                    90%   | (T-48h)                 |
|               |   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~   50%   | 0.1  ##  6%             |
|               |   ==============================  median | 0.2  ######  21%        |
|               |   ------------------------------ first   | 0.3  ##########  46%    |
|               |   print 0.4%                  | release  | 0.4  #####  19%  <first |
|               |   T-7d        T-3d       T-1d | T        | 0.5  ##  8%             |
|               +------------------------------------------+-------------------------+
|               | [Play] |----------o-------------------|  [T-7d][T-1d][T-1h][Final]  |
|               +--------------------------------------------------------------------+
|               | P(CPI > k) threshold view                 [Chart|Table] [Raw|Norm] |
|               | Market reaction on release day: 2y +6 bp, 10y +4 bp                |
|               | Sources: Kalshi KXCPI hourly snapshots; BLS CPI via ALFRED.  CSV   |
|               | > About this data (tickers, snapshot times, vintages, as_of rules) |
+---------------+--------------------------------------------------------------------+
```

Điện thoại (360 đến 390px). Thanh điều khiển dính ở đáy, trong tầm ngón cái, có `padding-bottom: env(safe-area-inset-bottom)`; nội dung có `scroll-padding-bottom` bằng chiều cao thanh để focus không bị che (2.4.11).

```
+----------------------------------+
| Macro Event Lab           [menu] |
| [CPI v] [Sep 2026 v]             |
| Released Oct 14, 08:30 ET        |
+----------------------------------+
| EXPECTED (T-1h)   FIRST PRINT    |
| 0.3%              0.4%           |
| 50%: 0.2 to 0.4   rev. 0.3%      |
| SURPRISE  +1.6 SD above mean     |
+----------------------------------+
| As of Oct 12 08:30 ET (T-48h)    |
| Readout: 0.3% = 46%              |
| 0.1 |##            6%            |
| 0.2 |######       21%            |
| 0.3 |##########   46%            |
| 0.4 |#####        19%  first     |
| 0.5 |##            8%            |
+----------------------------------+
| Fan chart, 4:5, 50% and 90%      |
| bands, right-edge labels         |
+----------------------------------+
| Reaction: 2y +6 bp  10y +4 bp    |
| Sources ... [Table] [CSV]        |
| > About this data                |
+----------------------------------+
| [>] |-------o--------|           |  <- sticky bar
| [T-7d] [T-1d] [T-1h] [Final]     |
+----------------------------------+
```

Thứ tự trên điện thoại cố ý đặt cặp số và biểu đồ bin trước fan chart: người đọc thấy kết luận trước, rồi mới thấy quá trình. Hover được thay bằng chạm để ghim; giá trị hiện ở dòng "Readout" cố định trên biểu đồ chứ không ở hộp nổi dưới ngón tay; chạm chỗ khác hoặc Escape để bỏ ghim. Biểu đồ đặt `touch-action: pan-y` để cuộn dọc vẫn hoạt động. ROADMAP hiện ghi "hover" cho trang 1; trên di động, hành vi này phải là chạm.

### Thành phần và design system

Dùng token màu như trên (Carbon blue và Radix slate), đặt tên theo kiểu chức năng của Primer (`bg`, `fg-muted`, `border-default`) để dễ đọc ([Primer light.css](https://unpkg.com/@primer/primitives/dist/css/functional/themes/light.css)). Thành phần: chỉ chép vài mảnh shadcn/ui cần thiết (tabs, toggle group, select hoặc combobox chọn sự kiện, collapsible cho "About this data", table) và ánh xạ biến `--primary`, `--background`, `--muted`, `--border`, `--ring`, `--chart-1` đến `--chart-5` sang token của dự án ([shadcn/ui theming](https://ui.shadcn.com/docs/theming)). Nếu không muốn Tailwind v4, dùng Radix Primitives trực tiếp với CSS thuần và biến CSS. Thanh trượt **không** dùng thành phần Slider tự viết mà dùng input range gốc, theo cảnh báo của APG. Biểu đồ: SVG tự viết trong React với `d3-scale`, `d3-shape` (`area` cho dải fan), `d3-array`; cách này giữ mỗi cột là một nút DOM có thể focus, đọc màu từ biến CSS nên đổi theme không cần vẽ lại logic, và nằm trong ngân sách khoảng 50 KB. Observable Plot là phương án làm mẫu nhanh nếu chấp nhận khoảng 85 đến 94 KB và việc vẽ lại SVG mỗi khung. Không dùng Plotly (401 kB cho bản basic), không dùng nguyên khối thành phần Carbon hay Primer vì sẽ trông như IBM hoặc GitHub. Mượn quy tắc dữ liệu của Carbon: không gradient, đảo thang tuần tự ở chế độ tối.

### Ngân sách hiệu năng và chiến lược nạp dữ liệu

Mục tiêu đo ở phân vị 75 trên điện thoại 4G: LCP tối đa 2.5 s, INP tối đa 200 ms, CLS tối đa 0.1 với mục tiêu thực là 0 ([web.dev](https://web.dev/articles/defining-core-web-vitals-thresholds)). Ngân sách đề xuất, cần kiểm bằng `vite build` cùng `rollup-plugin-visualizer`: JS khởi đầu (không tính DuckDB) dưới khoảng 150 KB gzip, trong đó mã biểu đồ dưới khoảng 50 KB; một file font biến thiên Latin; dữ liệu sự kiện mặc định trong một file nhỏ, preload hoặc nhúng sẵn vào HTML.

Chiến lược dữ liệu theo bốn tầng. Tầng một: pipeline Python và DuckDB sẵn có trong repo xuất một `manifest.json` (danh sách sự kiện, giờ công bố, đường dẫn file) và một file JSON hoặc Arrow IPC cho mỗi sự kiện, chứa sẵn mọi thứ màn hình cần: thời điểm snapshot, biên bin, xác suất raw và normalized, phân vị 5, 25, 50, 75, 95, trung bình và độ lệch chuẩn, con số đầu tiên, các bản sửa đổi kèm ngày vintage, và phản ứng thị trường. Mỗi lần kéo thanh trượt chỉ chọn một hàng đã tính, không bao giờ chạy truy vấn. Tầng hai: prerender `index.html` với văn bản đầu trang và SVG tĩnh của sự kiện mới nhất, rồi hydrate, để người dùng không bao giờ thấy biểu đồ trống. Tầng ba: tên file có hash nội dung và `Cache-Control: public, max-age=31536000, immutable` qua `_headers` của Cloudflare. Tầng bốn: DuckDB-WASM chỉ tải bằng `import()` động khi mở trang SQL, dùng `selectBundle` với `mvp` và `eh`, bỏ `coi` (không cần COOP/COEP, tránh đường bộ nhớ chia sẻ gây lỗi trên iOS), hiện tiến trình xác định ("Loading query engine, 4.2 MB" theo số đo thực), và nếu thất bại thì quay về dữ liệu dựng sẵn kèm thông báo nhỏ. Với file Parquet dưới khoảng 1 MB, tải nguyên file rồi `registerFileBuffer` đơn giản hơn range request. Trước khi tự host, đo kích thước thật của `duckdb-eh.wasm` 2.0.0; nếu vượt 25 MiB, tải từ jsDelivr (đường được tài liệu chính thức mô tả) hoặc đặt trên R2.

### Checklist khả năng tiếp cận

1. Chữ thường 4.5:1, chữ lớn 3:1, dấu biểu đồ và ranh giới điều khiển 3:1, vòng focus 4.5:1, kiểm ở cả hai chế độ.
2. Mỗi biểu đồ là `<figure>` với `<svg role="img" aria-labelledby>` trỏ tới tiêu đề và mô tả, `<figcaption>` chứa câu tóm tắt sinh tự động, và nút "Show data table" mở một `<table>` thật cho thời điểm đang chọn.
3. Thanh trượt gốc với `aria-valuetext`; mũi tên, Home, End, PageUp, PageDown hoạt động; chip đặt sẵn là phương án không kéo (2.5.7).
4. Biểu đồ chỉ chiếm một tab stop; bên trong dùng roving tabindex, mũi tên di chuyển giữa các cột; focus phản chiếu hover, Enter và Space phản chiếu click; không chiếm phím của trình đọc màn hình.
5. Không tự chạy animation; Play dừng được, dừng ở cuối; tôn trọng `prefers-reduced-motion`; không nhấp nháy.
6. Vùng chạm tối thiểu 24 x 24 CSS px, 44px trên `@media (pointer: coarse)` cho Play, chip, nút theme.
7. Thanh dính ở đáy không che phần tử đang focus (2.4.11).
8. Reflow ở 320px không cuộn ngang trang; bảng rộng nằm trong vùng cuộn riêng có `tabindex="0"`, `role="region"`, `aria-label`.
9. Màu không bao giờ là kênh duy nhất: dấu "+" và "−", nhãn trực tiếp, viền cho trạng thái chọn.
10. Không chữ nào nhỏ hơn 12px; thân bài 16px.
11. Ghi chú "How to read this chart" bằng ngôn ngữ dễ hiểu cho mỗi loại biểu đồ (Chartability xếp việc thiếu giải thích vào nhóm lỗi nghiêm trọng).
12. Theme ba trạng thái (System, Light, Dark), giải quyết trước lần vẽ đầu bằng script nội tuyến trong `<head>` (đọc `localStorage` trong try/catch, rồi `matchMedia`), đặt `data-theme` trên `<html>`; `lang="en"` trên `<html>`.
13. Kiểm bằng 14 tiêu chí nghiêm trọng của Chartability trước mỗi lần phát hành ([Chartability](https://github.com/Chartability/POUR-CAF)).

### Nên làm

1. Mở trang bằng một biểu đồ thật và cặp số "Market expected / First print", không bằng khẩu hiệu.
2. Ghi ngày vintage và thời điểm snapshot cạnh mọi con số.
3. Dùng xanh nhất quán cho thị trường, mực trung tính cho thực tế, cam và tím cho bất ngờ.
4. Đặt nhãn trực tiếp, in xác suất trên cột, chú thích bản sửa đổi nhỏ hơn con số đầu tiên.
5. Dùng chữ số tabular, căn phải, dấu trừ thật, đơn vị ở tiêu đề cột.
6. Cho phép chia sẻ đúng một khoảnh khắc qua URL.
7. Có chế độ bảng và tải CSV đúng những hàng đang vẽ.
8. Có trang Method giải thích cách suy xác suất từ giá Kalshi, chuẩn hóa, cách tính phân vị và định nghĩa `known_from` / `as_of`.
9. Viết giọng văn như tóm tắt nghiên cứu: cụ thể, tiết chế, có số kèm lý do.
10. Làm chế độ tối bằng thang riêng và kiểm tương phản lại từ đầu.

### Không nên làm

1. Không đưa một xác suất đơn lẻ không có khoảng.
2. Không dùng kim rung, đồng hồ đo, đếm số tăng dần hay animation tự chạy.
3. Không dùng gradient tím hoặc indigo, glassmorphism, blob nền, ba thẻ biểu tượng, thẻ lồng thẻ, bóng đổ trên mọi khối.
4. Không dùng đỏ và xanh lá làm tín hiệu duy nhất cho tăng giảm.
5. Không dùng trục y kép, không đổi tỷ lệ trục giữa animation.
6. Không dùng Radix blue-9 `#0090ff` làm nền nút có chữ trắng cỡ nhỏ.
7. Không chặn lần vẽ đầu bằng DuckDB-WASM, không chạy truy vấn mỗi lần kéo.
8. Không dùng Plotly hay nạp nguyên khối một thư viện biểu đồ lớn cho vài biểu đồ.
9. Không chỉ dựa vào hover; không dùng chú giải khi nhãn trực tiếp vừa chỗ.
10. Không dùng emoji, khẩu hiệu "AI-powered" hay "unlock insights".

### Quyết định mở cho chủ dự án

1. **Xanh chủ đạo:** Carbon Blue 60 `#0f62fe` (đề xuất, sâu và định chế, một màu dùng cho cả liên kết và nút) hay Radix blue (`#0090ff` sáng hơn, nhưng chữ và liên kết phải dùng blue-11 `#0d74ce`, 4.77:1, và nút chữ trắng chỉ dùng cho chữ lớn).
2. **Cặp bất ngờ:** cam và tím PuOr (đề xuất, giữ xanh độc quyền cho thị trường) hay xanh và vermillion Okabe-Ito (gắn bất ngờ dương với màu xanh yêu thích, nhưng gần như trùng độ chói với màu thị trường).
3. **Font:** Inter Variable (đề xuất, tính năng số được công bố) hay Geist Sans và Geist Mono (đậm chất "dev tool" hơn, nhưng cần tự kiểm `tnum` và `zero`), hay IBM Plex Sans (đồng bộ với Plex Mono và Plex Serif nếu muốn trang Method dạng bài luận).
4. **Thư viện biểu đồ:** SVG tự viết với d3 (đề xuất) hay Observable Plot để có bản đầu nhanh hơn.
5. **Vai trò DuckDB-WASM:** chỉ ở trang SQL (đề xuất) hay cả trang 1 như ROADMAP đang ghi.
6. **Hosting:** Cloudflare Pages (đề xuất, có `_headers`) hay GitHub Pages.
7. **Mặc định xác suất:** normalized hay raw khi mở trang.
8. **Đơn vị bất ngờ:** độ lệch chuẩn của phân phối ngụ ý, đơn vị gốc (điểm phần trăm, nghìn việc làm), hay cả hai; và với FOMC, định nghĩa bất ngờ là gì (ví dụ thay đổi lãi suất kỳ vọng so với thực tế).
9. **Có giữ nút Play ở v0 không:** ROADMAP có Play, nghiên cứu cho thấy giá trị phân tích của nó thấp; có thể để ở v1.
10. **Quantile dotplot 20 chấm:** thêm làm chế độ phụ hay bỏ để giữ tối giản.
11. **Thang trục thời gian:** tuyến tính theo giờ hay nén phần xa (vì biến động gần giờ công bố quan trọng hơn).

## Kết luận

Điều thay đổi sau khi tổng hợp là vai trò của màu xanh: nó không nên là "màu thương hiệu" phủ khắp trang mà là một mã hóa dữ liệu có nghĩa duy nhất, "đây là điều thị trường tin". Khi xanh mang nghĩa, mọi lựa chọn khác tự rơi vào chỗ: con số thực tế phải là mực trung tính để nổi bật khỏi niềm tin của thị trường, bất ngờ phải dùng màu khác xanh, và phép tính độ chói cho thấy cặp Okabe-Ito quen thuộc lại xung đột với chính màu chủ đạo. Tương tự, phát hiện về DuckDB-WASM đảo ngược một giả định trong ROADMAP: thứ gây ấn tượng với kỹ sư quant không phải là động cơ SQL chạy trong trình duyệt ở lần tải đầu, mà là một trang mở ra tức thì với con số đúng, có vintage, có cách tính, rồi mới cho phép đào sâu.

Hàm ý lớn hơn là sản phẩm này lấp một khoảng trống thật: không tham chiếu nào được khảo sát đặt phân phối ngụ ý từ thị trường, con số công bố lần đầu và bản sửa đổi lên cùng một khung. Vì không có tiền lệ, sự khác biệt sẽ đến từ kỷ luật chứ không phải từ hiệu ứng: ba biểu đồ bổ sung cho nhau thay vì một biểu đồ anh hùng, trạng thái tĩnh có thể chia sẻ thay vì animation, và một lớp nguồn gốc dữ liệu mà ngay cả FRED cũng không hiển thị mặc định. Các điểm còn phải kiểm trước khi chốt gồm: trang thị trường Kalshi thực tế, kích thước thật của DuckDB-WASM 2.0.0, tính năng `tnum` và `zero` trong file font được chọn, và mô phỏng mù màu cho cặp cam tím ở chế độ tối.

## Nguồn tham khảo

Báo chí dữ liệu và giao diện dữ liệu kinh tế
- OWID, Redesigning our interactive data visualizations: https://ourworldindata.org/redesigning-our-interactive-data-visualizations
- OWID, How to use Our World in Data: https://ourworldindata.org/how-to-use-our-world-in-data
- FT chart-doctor, Visual Vocabulary: https://github.com/Financial-Times/chart-doctor/tree/main/visual-vocabulary
- shadcn.io, FT DESIGN.md (suy ngược, chưa xác minh): https://www.shadcn.io/design/ft
- SlideSpeak, Economist-style prompt (chưa xác minh): https://slidespeak.co/slide-design-prompts/prompts/economist-style
- Gregor Aisch, Jittery gauges: http://www.vis4.net/blog/jittery-gauges-election-forecast/
- FlowingData, Needle of uncertainty (2018): https://flowingdata.com/2018/03/14/needle-of-uncertainty
- FlowingData, Showing uncertainty during the live election forecast (2016): https://flowingdata.com/2016/11/15/showing-uncertainty-during-the-live-election-forecast/
- Nieman Lab, FiveThirtyEight 2020 uncertainty: https://www.niemanlab.org/2020/07/this-is-how-fivethirtyeight-is-trying-to-build-the-right-amount-of-uncertainty-into-its-2020-election-data-analysis/
- Information is Beautiful Awards, FiveThirtyEight 2020 forecast: https://www.informationisbeautifulawards.com/showcase/5638-fivethirtyeight-s-2020-election-forecast
- Hullman lab, Information, incentives, and goals in election forecasts: https://www.hullmanlab.northwestern.edu/paper/2020/09/01/election-forecasts.html
- St. Louis Fed, FRED gets a facelift (2016): https://www.stlouisfed.org/news-releases/2016/07/20/st-louis-feds-fred-gets-a-facelift
- St. Louis Fed, FRED enhanced graphing (2013): https://www.stlouisfed.org/news-releases/2013/11/20/fred-rolls-out-enhanced-graphing-functionality-and-upgraded-apps
- FRED news, Enhanced graphing (2024): https://news.research.stlouisfed.org/2024/11/fred-offers-enhanced-graphing/
- PolyChart, Chrome Web Store (bên thứ ba): https://chromewebstore.google.com/detail/gdfcfkbghfcpbepdeehfnofadgmjbmio
- Mintlify, Polymarket price tracking example (bên thứ ba): https://www.mintlify.com/stat-guy/polymarket/examples/price-tracking
- Datawrapper Academy, axis labels: https://www.datawrapper.de/academy/why-datawrapper-does-not-include-axis-labels-for-many-charts
- Datawrapper, mobile first: https://www.datawrapper.de/blog/datawrapper-becomes-mobile-first-charting-tool

Nghiên cứu trực quan hóa bất định
- Bateman et al. 2010, Useful Junk?: https://vis.csail.mit.edu/classes/6.859/readings/pdfs/Bateman-UsefulJunk.pdf
- Few 2011: https://webspace.science.uu.nl/~telea001/uploads/VACourse/Few11.pdf
- Robertson et al. 2008: https://faculty.cc.gatech.edu/~stasko/papers/infovis08-anim.pdf
- Brehmer et al. 2019: https://arxiv.org/pdf/1907.03919
- Kay et al. 2016, When (ish) is my bus?: https://vis.mit.edu/classes/6.859/readings/pdfs/Kay-WhenishIsMyBus.pdf
- Fernandes et al. 2018: https://mucollective.northwestern.edu/project/uncertainty-bus
- Wilke, Visualizing uncertainty: https://clauswilke.com/dataviz/visualizing-uncertainty.html
- Hullman, Resnick, Adar 2015, HOPs: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4646698/
- Correll và Gleicher 2014, Error Bars Considered Harmful: https://graphics.cs.wisc.edu/Vis/ErrorBars/
- Heer và Robertson 2007, Animated transitions: https://idl.uw.edu/papers/animated-transitions
- Bank of England 1998, Understanding the fan chart: https://www.bankofengland.co.uk/-/media/boe/files/quarterly-bulletin/1998/the-inflation-report-projections-understanding-the-fan-chart
- Czech National Bank, Forecast February 2009: https://www.cnb.cz/en/monetary-policy/forecast/cnb-forecast-archive/CNB-forecast-February-2009-00011

Trang sản phẩm kỹ thuật, fintech và quỹ quant
- Vercel Geist Typography: https://vercel.com/geist/typography
- Vercel Geist Colors: https://vercel.com/geist/colors
- Vercel Geist Introduction: https://vercel.com/geist/introduction
- Vercel Font: https://vercel.com/font
- Stripe, Designing accessible color systems: https://stripe.com/blog/accessible-color-systems
- Linear, How we redesigned the Linear UI part II: https://linear.app/now/how-we-redesigned-the-linear-ui
- Linear, Behind the latest design refresh: https://linear.app/now/behind-the-latest-design-refresh
- 925 Studios, AI slop design tells: https://www.925studios.co/blog/ai-slop-design-tells
- Trang chủ được kiểm tra CSS ngày 2026-10-26: https://vercel.com/, https://stripe.com/, https://linear.app/, https://www.raycast.com/, https://mercury.com/, https://www.janestreet.com/, https://www.deshaw.com/, https://www.optiver.com/, https://www.twosigma.com/, https://www.hudsonrivertrading.com/

Chữ, màu và design system
- Inter: https://rsms.me/inter/
- Inter v4.0 release: https://github.com/rsms/inter/releases/tag/v4.0
- IBM Plex: https://github.com/IBM/plex
- MDN, font-variant-numeric: https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric
- Radix Themes typography: https://www.radix-ui.com/themes/docs/theme/typography
- Radix Colors, understanding the scale: https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale
- Radix Colors blue, blue-dark, slate-dark: https://unpkg.com/@radix-ui/colors@3.0.0/blue.css, https://unpkg.com/@radix-ui/colors@3.0.0/blue-dark.css, https://unpkg.com/@radix-ui/colors@3.0.0/slate-dark.css
- Carbon type sets: https://carbondesignsystem.com/elements/typography/type-sets/
- Carbon color overview: https://carbondesignsystem.com/elements/color/overview/
- Carbon color tokens: https://carbondesignsystem.com/elements/color/tokens/
- Carbon data visualization palettes: https://carbondesignsystem.com/data-visualization/color-palettes/
- Primer primitives light và dark: https://unpkg.com/@primer/primitives/dist/css/functional/themes/light.css, https://unpkg.com/@primer/primitives/dist/css/functional/themes/dark.css
- Material Design 2, Dark theme: https://m2.material.io/design/color/dark-theme
- ColorBrewer schemes: https://raw.githubusercontent.com/axismaps/colorbrewer/master/colorbrewer_schemes.js
- NYU Siegal lab, Okabe-Ito palette (thứ cấp): https://siegal.bio.nyu.edu/color-palette/
- shadcn/ui theming: https://ui.shadcn.com/docs/theming
- Radix Themes repo: https://github.com/radix-ui/themes
- Primer React: https://github.com/primer/react
- Carbon repo: https://github.com/carbon-design-system/carbon
- W3C, Understanding 1.4.11 Non-text Contrast: https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
- W3C, WCAG 2.2: https://www.w3.org/TR/WCAG22/
- W3C, WCAG 3.0 Working Draft: https://www.w3.org/TR/WCAG3/

Tương tác, hiệu năng, khả năng tiếp cận, hosting
- DuckDB Wasm overview: https://duckdb.org/docs/2.0/clients/wasm/overview.html
- DuckDB Wasm instantiation: https://duckdb.org/docs/2.0/clients/wasm/instantiation.html
- observablehq/framework issue 1260: https://github.com/observablehq/framework/issues/1260
- WebKit bug 221530: https://bugs.webkit.org/show_bug.cgi?id=221530
- WebKit bug 255103: https://bugs.webkit.org/show_bug.cgi?id=255103
- plotly.js dist README: https://github.com/plotly/plotly.js/blob/master/dist/README.md
- TanStack charts comparison (nhà cung cấp): https://tanstack.com/charts/latest/docs/comparison
- PkgPulse, visx vs recharts: https://www.pkgpulse.com/compare/visx__visx-vs-recharts
- web.dev, Defining Core Web Vitals thresholds: https://web.dev/articles/defining-core-web-vitals-thresholds
- WAI-ARIA APG slider pattern: https://www.w3.org/WAI/ARIA/apg/patterns/slider/
- Chartability POUR-CAF: https://github.com/Chartability/POUR-CAF
- W3C, Understanding 2.5.8 Target Size (Minimum): https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- Cloudflare Pages limits: https://developers.cloudflare.com/pages/platform/limits/
- Cloudflare Pages headers: https://developers.cloudflare.com/pages/configuration/headers/
- GitHub Pages limits: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
