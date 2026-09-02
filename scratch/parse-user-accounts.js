const fs = require("fs");

const raw = `Mama's Restaurant 	Huntington Beach	Per Service	Juan Romero	11.11	$200.00	Weekly	$1,898.00		$902.00	Check	Apr 2024	Apr 2026	2/18/26	4/10/26	$44.00				Y												
Mama's Restaurant 	 Los Alamitos	Per Service	Juan Romero	11.11	$200.00	Weekly	$2,028.00		$1,170.00	Check	Dec 2024	Dec 2025	2/18/26	4/16/26	$44.00				Y												
Swing Easy Golf Club	Costa Mesa	Flat rate	Sandra Hernandez	3	$69.00	Weekly	$520.00	$104.00	$221.00	Credit Card	May 2025	May 2026	4/15/26	3/12/26	$44.00				Y												
Swing Easy Golf Club	Yorba Linda	Flat rate		4	$92.00	Every 2 weeks	$486.00	$162.00	$286.00	Credit Card	Apr 2025	Apr 2026	4/15/26	3/12/26	$44.00				Y												
Green Leaf Botanicals	Whittier	per Service	Lorena Benitez		$119.00	Monthly	$238.00		$119.00	Credit Card	Jun 2024	Jun 2026	2/18/26						N												
Sierra Analytical	Aliso Viejo	per Service	Luz Uribe	5	$115.00	Every 2 weeks	$533.00		$240.50	Check	Apr 2025	Apr 2026	2/18/26		$44.00				Y												
University Park Dental	Irvine	per Service		2.25	$51.75	Every 2 weeks	$325.00		$212.87	Credit Card	Jun 2025	Jun 2026		4/13/26	$44.00				Y																							
Kott Koatings	Lake Forest	per Service		3	$69.00	Every week	$606.67		$307.67	Check	Jul 2025	Jul 2026	2/18/26		$44.00				N												
Kush Fine Art	Laguna Beach	per Service	Ana morales	3	$69.00	Every 3 weeks	$340.00		$244.69	Credit Card	Jul 2025	Jul 2026							Y												
Posh Pooch 	Seal Beach	per Service	Luz Uribe	4	$92.00	Monthly	$338.00		$246.00	Credit Card	Aug 2025	Aug 2026	2/18/26						N												
Renewable Farms	Aliso Viejo	per Service	Ana Morales	3	$69.00	As needed	$720.00		$324.00	Credit Card	Nov 2025	Nov 2026	2/18/26						Y												
ILG Irvine Office	Irvine	Flat rate	Maria Lopez	4	$92.00	3x per week	$1,800.00	$138.46	$604.00	Check	Dec 2025	Dec 2026	2/18/26	4/14/26	$44.00			$150.00	Y												
ILG Corona Office	Corona	Flat rate	Sandra Hernandez	3	$69.00	3x per week	$1,163.00	$89.46	$266.00	Check	Dec 2025	Dec 2026	2/18/26	3/11/26	$44.00			$96.92	Y												
ILG Westlake	Westlake Village	Flat rate	Emmi Guerra	2.5	$57.50	3x per week	$1,130.00	$86.92	$382.50	Check	Feb 2026	Feb 2027	2/18/26		$66.00			$94.17													
ILG Valencia Office	Valencia	Flat rate	Emmi Guerra	4.5	$103.50	3x per week	$1,890.00	$157.50	$544.50	Check	Feb 2026	Feb 2027	2/18/26		$66.00			$157.50													
Elevate Aerial HB	Huntington Beach	Flat rate	Luz Uribe	6	$138.00	1x per week	$800.00	$160.00	$302.00	Check	Dec 2025	Dec 2026	2/18/26	4/14/26	$44.00				Y												
VNTR Fitness	Rancho Santa Margarita	flat rate	Ana Morales	2.5	$57.50	3x per week	$1,258.00	$89.86	$400.00	Credit Card	Jan 2026	Jan 2027		4/20/26	$44.00			$104.83													
MIWA Office	Irvine	per Service		2	$46.00	1x per week	$480.00		$241.00	ACH	Dec 2025	Dec 2026			$44.00			$120.00	Y												
OCSS Office	Huntington Beach	flat rate	Mirna Contreras	2.5	$57.50	Twice a month	$380.00	$190.00	$255.00	Credit Card	Jan 2026	Jan 2027			$44.00			$190.00													
13demarzo	Irvine	flat rate	Sandra Hernandez	2.5	$57.50	2x per week	$950.00	$105.56	$451.00	Credit Card	Feb 2026	Feb 2027	2/18/26	4/14/26	$44.00																
Miracle Minds	Newport	flate rate	Luz Uribe	2.75	$63.25	2x per week	$1,750.00	$145.83	$927.75	Credit Card	Feb 2026	Feb 2027	2/18/26	3/10/26	$44.00																
The Harper Wedding Venue	Costa Mesa	per Service	Juan Romero	4	$92.00	As needed	$2,300.00	$255.56	$1,380.00	Check	Feb 2026	Feb 2027		4/18/26	$44.00																
Wren Spa	Costa Mesa	flat rate	Luz Uribe	4	$92.00	1x per week	$740.00	$148.00	$341.00	Credit card	Mar 2026	Jun 2026		4/9/26	$44.00																
GLOBAR Medspa	Costa Mesa	flat rate	Juan Romero	3	$69.00	2x per week	$1,450.00	$161.11	$982.00	Zelle	Apr 2026			4/14/26	$44.00																
Steripax	Huntington Beach	flat rate	Lucia Portillo	6 and 8		5x per week	$5,152.70		$1,766.64	ACH	Apr 2026			4/13/26	$44.00																
MacArthur Dental Arts	Irvine	Flat Rate	Kassandra Valentin	1.5 and 3 hours Thursday		4x per week	$1,060.00		$313.08	Credit card	Apr 2026			4/14/26	$44.00																
LSG Sky Chefs	Costa Mesa	Flat Rate	Luz and Vanessa	10	$230.00	7x per week	$10,750.00		$3,255.00	ACH	Jun 2026				$381.00																
MOXI3 Costa Mesa	Costa Mesa	Flat Rate	Luz Uribe	3	$69.00	2x per week	$1,100.00	$122.22	$458.00	Credit card	Jun 2026				$44.00																
MOXI3 Dana Point	Dana Point	Flat Rate	Ana Morales	3	$69.00	2x per week	$1,000.00	$111.11	$358.00	Credit card	Jun 2026				$44.00																
Cornerstone Rehab	Santa Ana	Flat Rate	Kassandra Valentin	7	$161.00		$2,850.00	$219.23	$906.50	Credit card	Aug 2026				$44.00																
Lifted Dentistry	Irvine	per service		3	$69.00	every other week	$335.00	$25.77	$186.00	zelle	Aug 2026`;

const lines = raw.trim().split("\n");
console.log("Total accounts provided:", lines.length);

const parsed = lines.map(line => {
  const parts = line.split("\t").map(p => p.trim());
  return {
    name: parts[0],
    city: parts[1],
    pricing_model: parts[2],
    cleaner: parts[3] || "Unassigned",
    hours: parts[4],
    rate_per_service: parts[5],
    frequency: parts[6],
    revenue: parts[7],
    col9: parts[8],
    profit_or_cost: parts[9],
    payment_method: parts[10],
    contract_start: parts[11],
    contract_end: parts[12],
    last_contact: parts[13],
    last_qcc: parts[14],
  };
});

console.log(JSON.stringify(parsed, null, 2));
