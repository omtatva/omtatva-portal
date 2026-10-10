export type SelectOption = {
  value: string;
  label: string;
};

type StateCityMap = {
  [state: string]: string[];
};

const rawData: StateCityMap = {
  "Andhra Pradesh": [
    "Adoni", "Alluri Sitharama Raju", "Amalapuram", "Anakapalli",
    "Anantapur", "Annamayya", "Bapatla", "Bhimavaram", "Chittoor",
    "Eluru", "Guntur", "Kadapa", "Kakinada", "Konaseema", "Kurnool",
    "Machilipatnam", "Madanapalle", "Nandyal", "Nellore", "Ongole",
    "Palnadu", "Parvathipuram Manyam", "Prakasam", "Rajahmundry",
    "Sri Sathya Sai", "Srikakulam", "Tirupati", "Vijayawada",
    "Visakhapatnam", "Vizianagaram", "West Godavari"
  ],

  "Arunachal Pradesh": [
    "Aalo", "Anjaw", "Bhalukpong", "Bomdila", "Changlang", "Dibang Valley",
    "East Kameng", "East Siang", "Itanagar", "Kamle", "Keyi Panyor",
    "Kra Daadi", "Kurung Kumey", "Lepa Rada", "Lohit", "Longding",
    "Lower Dibang Valley", "Lower Siang", "Lower Subansiri", "Namsai",
    "Naharlagun", "Pakke-Kessang", "Papum Pare", "Pasighat", "Roing",
    "Shi Yomi", "Siang", "Tawang", "Tezu", "Tirap", "Upper Siang",
    "Upper Subansiri", "West Kameng", "West Siang", "Yupia", "Ziro"
  ],

  "Assam": [
    "Bajali", "Baksa", "Barpeta", "Biswanath", "Bongaigaon", "Cachar",
    "Charaideo", "Chirang", "Darrang", "Dhemaji", "Dhubri", "Dibrugarh",
    "Dima Hasao", "Goalpara", "Golaghat", "Guwahati", "Hailakandi",
    "Hojai", "Jorhat", "Kamrup", "Kamrup Metropolitan", "Karbi Anglong",
    "Karimganj", "Kokrajhar", "Lakhimpur", "Majuli", "Mangaldoi",
    "Morigaon", "Nagaon", "Nalbari", "North Lakhimpur", "Sivasagar",
    "Silchar", "Sonitpur", "South Salmara-Mankachar", "Tamulpur",
    "Tezpur", "Tinsukia", "Udalguri", "West Karbi Anglong"
  ],

  "Bihar": [
    "Araria", "Arwal", "Aurangabad", "Banka", "Begusarai", "Bettiah",
    "Bhagalpur", "Bihar Sharif", "Bhojpur", "Buxar", "Chhapra",
    "Darbhanga", "East Champaran", "Gaya", "Gopalganj", "Hajipur",
    "Jamui", "Jehanabad", "Kaimur", "Katihar", "Khagaria", "Kishanganj",
    "Lakhisarai", "Madhepura", "Madhubani", "Munger", "Muzaffarpur",
    "Nalanda", "Nawada", "Patna", "Purnia", "Rohtas", "Saharsa",
    "Samastipur", "Saran", "Sheikhpura", "Sheohar", "Sitamarhi",
    "Siwan", "Supaul", "Vaishali", "West Champaran"
  ],

  "Chhattisgarh": [
    "Balod", "Baloda Bazar", "Balrampur", "Bastar", "Bemetara",
    "Bhilai", "Bijapur", "Bilaspur", "Dantewada", "Dhamtari", "Durg",
    "Gaurela-Pendra-Marwahi", "Gariaband", "Janjgir-Champa", "Jashpur",
    "Kabirdham", "Kanker", "Khairagarh-Chhuikhadan-Gandai",
    "Kondagaon", "Korba", "Koriya", "Mahasamund",
    "Manendragarh-Chirmiri-Bharatpur", "Mohla-Manpur-Ambagarh Chowki",
    "Mungeli", "Narayanpur", "Raigarh", "Raipur", "Rajnandgaon",
    "Sakti", "Sarangarh-Bilaigarh", "Sukma", "Surajpur", "Surguja"
  ],

  "Goa": [
    "Bicholim", "Canacona", "Mapusa", "Margao", "Mormugao",
    "North Goa", "Panaji", "Pernem", "Ponda", "South Goa",
    "Vasco da Gama"
  ],

  "Gujarat": [
    "Ahmedabad", "Amreli", "Anand", "Aravalli", "Banaskantha",
    "Bharuch", "Bhavnagar", "Botad", "Chhota Udaipur", "Dahod",
    "Dang", "Devbhoomi Dwarka", "Gandhinagar", "Gir Somnath",
    "Jamnagar", "Junagadh", "Kheda", "Kutch", "Mahisagar",
    "Mehsana", "Morbi", "Narmada", "Navsari", "Panchmahal",
    "Patan", "Porbandar", "Rajkot", "Sabarkantha", "Surat",
    "Surendranagar", "Tapi", "Vadodara", "Valsad", "Vapi",
    "Veraval"
  ],

  "Haryana": [
    "Ambala", "Bhiwani", "Charkhi Dadri", "Faridabad", "Fatehabad",
    "Gurugram", "Hisar", "Jhajjar", "Jind", "Kaithal", "Karnal",
    "Kurukshetra", "Mahendragarh", "Manesar", "Narnaul", "Nuh",
    "Palwal", "Panchkula", "Panipat", "Rewari", "Rohtak", "Sirsa",
    "Sonipat", "Yamunanagar"
  ],

  "Himachal Pradesh": [
    "Bilaspur", "Chamba", "Dharamshala", "Hamirpur", "Kangra",
    "Kinnaur", "Kullu", "Lahaul and Spiti", "Manali", "Mandi",
    "Nahan", "Shimla", "Sirmaur", "Solan", "Una"
  ],

  "Jharkhand": [
    "Bokaro", "Chaibasa", "Chatra", "Deoghar", "Dhanbad", "Dumka",
    "East Singhbhum", "Garhwa", "Giridih", "Godda", "Gumla",
    "Hazaribagh", "Jamshedpur", "Jamtara", "Khunti", "Koderma",
    "Latehar", "Lohardaga", "Pakur", "Palamu", "Ramgarh", "Ranchi",
    "Sahibganj", "Seraikela-Kharsawan", "Simdega", "West Singhbhum"
  ],

  "Karnataka": [
    "Bagalkot", "Ballari", "Belagavi", "Bengaluru", "Bengaluru Rural",
    "Bidar", "Chamarajanagar", "Chikkaballapur", "Chikkamagaluru",
    "Chitradurga", "Dakshina Kannada", "Davanagere", "Dharwad",
    "Gadag", "Hassan", "Haveri", "Hubballi", "Kalaburagi", "Kodagu",
    "Kolar", "Koppal", "Mandya", "Mangaluru", "Mysuru", "Raichur",
    "Ramanagara", "Shivamogga", "Tumakuru", "Udupi",
    "Uttara Kannada", "Vijayapura", "Vijayanagara", "Yadgir"
  ],

  "Kerala": [
    "Alappuzha", "Aluva", "Ernakulam", "Idukki", "Kannur",
    "Kasaragod", "Kochi", "Kollam", "Kottayam", "Kozhikode",
    "Malappuram", "Palakkad", "Pathanamthitta", "Thiruvananthapuram",
    "Thrissur", "Wayanad"
  ],

  "Madhya Pradesh": [
    "Agar Malwa", "Alirajpur", "Anuppur", "Ashoknagar", "Balaghat",
    "Barwani", "Betul", "Bhind", "Bhopal", "Burhanpur", "Chhatarpur",
    "Chhindwara", "Damoh", "Datia", "Dewas", "Dhar", "Dindori",
    "Guna", "Gwalior", "Harda", "Indore", "Jabalpur", "Jhabua",
    "Katni", "Khandwa", "Khargone", "Maihar", "Mandla", "Mandsaur",
    "Mauganj", "Morena", "Narmadapuram", "Narsinghpur", "Neemuch",
    "Niwari", "Pandhurna", "Panna", "Raisen", "Rajgarh", "Ratlam",
    "Rewa", "Sagar", "Satna", "Sehore", "Seoni", "Shahdol",
    "Shajapur", "Sheopur", "Shivpuri", "Sidhi", "Singrauli",
    "Tikamgarh", "Ujjain", "Umaria", "Vidisha"
  ],

  "Maharashtra": [
    "Ahmednagar", "Akola", "Amravati", "Aurangabad", "Beed",
    "Bhandara", "Buldhana", "Chandrapur", "Dhule", "Gadchiroli",
    "Gondia", "Hingoli", "Jalgaon", "Jalna", "Kolhapur", "Latur",
    "Mumbai", "Mumbai Suburban", "Nagpur", "Nanded", "Nandurbar",
    "Nashik", "Osmanabad", "Palghar", "Parbhani", "Pune", "Raigad",
    "Ratnagiri", "Sangli", "Satara", "Sindhudurg", "Solapur", "Thane",
    "Wardha", "Washim", "Yavatmal"
  ],

  "Manipur": [
    "Bishnupur", "Chandel", "Churachandpur", "Imphal", "Imphal East",
    "Imphal West", "Jiribam", "Kakching", "Kamjong", "Kangpokpi",
    "Noney", "Pherzawl", "Senapati", "Tamenglong", "Tengnoupal",
    "Thoubal", "Ukhrul"
  ],

  "Meghalaya": [
    "East Garo Hills", "East Jaintia Hills", "East Khasi Hills",
    "Eastern West Khasi Hills", "Jowai", "North Garo Hills",
    "Ri Bhoi", "Shillong", "South Garo Hills", "South West Garo Hills",
    "South West Khasi Hills", "Tura", "West Garo Hills",
    "West Jaintia Hills", "West Khasi Hills"
  ],

  "Mizoram": [
    "Aizawl", "Champhai", "Hnahthial", "Khawzawl", "Kolasib",
    "Lawngtlai", "Lunglei", "Mamit", "Saiha", "Saitual", "Serchhip"
  ],

  "Nagaland": [
    "Chumoukedima", "Dimapur", "Kiphire", "Kohima", "Longleng",
    "Mokokchung", "Mon", "Niuland", "Noklak", "Peren", "Phek",
    "Shamator", "Tseminyu", "Tuensang", "Wokha", "Zunheboto"
  ],

  "Odisha": [
    "Angul", "Balangir", "Balasore", "Bargarh", "Baripada", "Bhadrak",
    "Bhubaneswar", "Boudh", "Cuttack", "Deogarh", "Dhenkanal",
    "Gajapati", "Ganjam", "Jagatsinghpur", "Jajpur", "Jharsuguda",
    "Kalahandi", "Kandhamal", "Kendrapara", "Kendujhar", "Khordha",
    "Koraput", "Malkangiri", "Mayurbhanj", "Nabarangpur", "Nayagarh",
    "Nuapada", "Puri", "Rayagada", "Rourkela", "Sambalpur",
    "Subarnapur", "Sundargarh"
  ],

  "Punjab": [
    "Amritsar", "Barnala", "Bathinda", "Faridkot", "Fatehgarh Sahib",
    "Fazilka", "Ferozepur", "Gurdaspur", "Hoshiarpur", "Jalandhar",
    "Kapurthala", "Ludhiana", "Malerkotla", "Mansa", "Moga",
    "Mohali", "Muktsar", "Pathankot", "Patiala", "Rupnagar",
    "Sangrur", "Shaheed Bhagat Singh Nagar", "Tarn Taran"
  ],

  "Rajasthan": [
    "Ajmer", "Alwar", "Anupgarh", "Balotra", "Banswara", "Baran",
    "Barmer", "Beawar", "Bharatpur", "Bhilwara", "Bikaner", "Bundi",
    "Chittorgarh", "Churu", "Dausa", "Deeg", "Dholpur", "Didwana-Kuchaman",
    "Dudu", "Dungarpur", "Gangapur City", "Hanumangarh", "Jaipur",
    "Jaisalmer", "Jalore", "Jhalawar", "Jhunjhunu", "Jodhpur",
    "Karauli", "Kekri", "Khairthal-Tijara", "Kota", "Kotputli-Behror",
    "Nagaur", "Neem Ka Thana", "Pali", "Phalodi", "Pratapgarh",
    "Rajsamand", "Salumber", "Sanchore", "Sawai Madhopur",
    "Shahpura", "Sikar", "Sirohi", "Sri Ganganagar", "Tonk",
    "Udaipur"
  ],

  "Sikkim": [
    "Gangtok", "Gyalshing", "Mangan", "Namchi", "Pakyong", "Soreng"
  ],

  "Tamil Nadu": [
    "Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore",
    "Dharmapuri", "Dindigul", "Erode", "Kallakurichi", "Kanchipuram",
    "Kanniyakumari", "Karur", "Krishnagiri", "Madurai", "Mayiladuthurai",
    "Nagapattinam", "Namakkal", "Nilgiris", "Perambalur",
    "Pudukkottai", "Ramanathapuram", "Ranipet", "Salem", "Sivaganga",
    "Tenkasi", "Thanjavur", "Theni", "Thoothukudi", "Tiruchirappalli",
    "Tirunelveli", "Tirupathur", "Tiruppur", "Tiruvallur",
    "Tiruvannamalai", "Tiruvarur", "Vellore", "Viluppuram",
    "Virudhunagar"
  ],

  "Telangana": [
    "Adilabad", "Bhadradri Kothagudem", "Hanamkonda", "Hyderabad",
    "Jagtial", "Jangaon", "Jayashankar Bhupalpally", "Jogulamba Gadwal",
    "Kamareddy", "Karimnagar", "Khammam", "Komaram Bheem Asifabad",
    "Mahabubabad", "Mahabubnagar", "Mancherial", "Medak",
    "Medchal-Malkajgiri", "Mulugu", "Nagarkurnool", "Nalgonda",
    "Narayanpet", "Nirmal", "Nizamabad", "Peddapalli",
    "Rajanna Sircilla", "Rangareddy", "Sangareddy", "Siddipet",
    "Suryapet", "Vikarabad", "Wanaparthy", "Warangal",
    "Yadadri Bhuvanagiri"
  ],

  "Tripura": [
    "Agartala", "Dhalai", "Dharmanagar", "Gomati", "Khowai",
    "North Tripura", "Sepahijala", "South Tripura", "Udaipur",
    "Unakoti", "West Tripura"
  ],

  "Uttar Pradesh": [
    "Agra", "Aligarh", "Ambedkar Nagar", "Amethi", "Amroha", "Auraiya",
    "Ayodhya", "Azamgarh", "Baghpat", "Bahraich", "Ballia",
    "Balrampur", "Banda", "Barabanki", "Bareilly", "Basti", "Bhadohi",
    "Bijnor", "Budaun", "Bulandshahr", "Chandauli", "Chitrakoot",
    "Deoria", "Etah", "Etawah", "Farrukhabad", "Fatehpur", "Firozabad",
    "Gautam Buddha Nagar", "Ghaziabad", "Ghazipur", "Gonda",
    "Gorakhpur", "Greater Noida", "Hamirpur", "Hapur", "Hardoi",
    "Hathras", "Jalaun", "Jaunpur", "Jhansi", "Kannauj", "Kanpur",
    "Kanpur Dehat", "Kanpur Nagar", "Kasganj", "Kaushambi", "Kheri",
    "Kushinagar", "Lalitpur", "Lucknow", "Maharajganj", "Mahoba",
    "Mainpuri", "Mathura", "Mau", "Meerut", "Mirzapur", "Moradabad",
    "Muzaffarnagar", "Noida", "Pilibhit", "Pratapgarh", "Prayagraj",
    "Rae Bareli", "Rampur", "Saharanpur", "Sambhal",
    "Sant Kabir Nagar", "Shahjahanpur", "Shamli", "Shravasti",
    "Siddharthnagar", "Sitapur", "Sonbhadra", "Sultanpur", "Unnao",
    "Varanasi", "Vrindavan"
  ],

  "Uttarakhand": [
    "Almora", "Bageshwar", "Chamoli", "Champawat", "Dehradun",
    "Haldwani", "Haridwar", "Nainital", "Pauri Garhwal",
    "Pithoragarh", "Rishikesh", "Roorkee", "Rudraprayag",
    "Tehri Garhwal", "Udham Singh Nagar", "Uttarkashi"
  ],

  "West Bengal": [
    "Alipurduar", "Asansol", "Bankura", "Birbhum", "Cooch Behar",
    "Dakshin Dinajpur", "Darjeeling", "Durgapur", "Hooghly", "Howrah",
    "Jalpaiguri", "Jhargram", "Kalimpong", "Kolkata", "Malda",
    "Murshidabad", "Nadia", "North 24 Parganas", "Paschim Bardhaman",
    "Paschim Medinipur", "Purba Bardhaman", "Purba Medinipur",
    "Purulia", "Siliguri", "South 24 Parganas", "Uttar Dinajpur"
  ],

  // Union Territories
  "Andaman and Nicobar Islands": [
    "Car Nicobar", "Diglipur", "Mayabunder", "Nicobar",
    "North and Middle Andaman", "Port Blair", "South Andaman"
  ],

  "Chandigarh": [
    "Chandigarh"
  ],

  "Dadra and Nagar Haveli and Daman and Diu": [
    "Dadra and Nagar Haveli", "Daman", "Diu", "Silvassa"
  ],

  "Delhi": [
    "Central Delhi", "Chanakyapuri", "Civil Lines", "Dwarka",
    "East Delhi", "Karol Bagh", "New Delhi", "North Delhi",
    "North East Delhi", "North West Delhi", "Old Delhi", "Rohini",
    "Saket", "Shahdara", "South Delhi", "South East Delhi",
    "South West Delhi", "West Delhi"
  ],

  "Jammu and Kashmir": [
    "Anantnag", "Bandipora", "Baramulla", "Budgam", "Doda",
    "Ganderbal", "Jammu", "Kathua", "Kishtwar", "Kulgam", "Kupwara",
    "Poonch", "Pulwama", "Rajouri", "Ramban", "Reasi", "Samba",
    "Shopian", "Srinagar", "Udhampur"
  ],

  "Ladakh": [
    "Kargil", "Leh"
  ],

  "Lakshadweep": [
    "Agatti", "Amini", "Andrott", "Bitra", "Chetlat", "Kadmat",
    "Kalpeni", "Kavaratti", "Kiltan", "Minicoy"
  ],

  "Puducherry": [
    "Karaikal", "Mahe", "Puducherry", "Yanam"
  ],
};

// react-select expects { value, label } options — same shape as countries.ts
export const indianStates: SelectOption[] = Object.keys(rawData).map(
  (state) => ({ value: state, label: state })
);

export const getCitiesForState = (state: string | undefined | null): SelectOption[] => {
  if (!state || !rawData[state]) return [];
  return rawData[state].map((city) => ({ value: city, label: city }));
};